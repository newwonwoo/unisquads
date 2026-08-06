// 주소 배치의 동시 호출 제어.
//
// 주소 그룹끼리는 서로 의존하지 않는다. groupHints와 dongsoAnchors는 루프
// 시작 전에 원문만으로 계산되고(app.js의 buildGroupHints/buildDongsoAnchors),
// 주소군 전파·후보 교집합은 루프가 끝난 뒤에 돈다. 각 그룹은 자기 행 인덱스에만
// 쓴다. 그래서 완료 순서가 결과를 바꾸지 않는다.
//
// 다만 JUSO·네이버의 실제 허용치를 모르므로 고정 동시성은 위험하다. 낮게
// 시작해 성공이 쌓이면 천천히 올리고, 일시 오류가 나오면 즉시 반으로 줄인다.

export const BATCH_CONCURRENCY_VERSION = "batch-concurrency-v1";

export const DEFAULT_CONCURRENCY = Object.freeze({
  start: 4,
  min: 1,
  max: 12,
  // 이만큼 연속 성공해야 한 단계 올린다. 올리는 건 느리게, 내리는 건 즉시.
  raiseAfter: 25
});

// 원천별 기본값.
//
// 네이버 검색 오픈API 공식 제한: 초당 10회(QPS 10), 앱당 하루 25,000회.
//   https://developers.naver.com/docs/common/openapiguide/errormessage.md (429 Too Many Requests)
// 간격 120ms면 상한 약 8.3 QPS로 공식 한도 아래에 머문다. 동시 실행 수는
// 간격과 별개로 응답이 느릴 때 요청이 쌓이는 것을 막는 역할만 한다.
//
// JUSO(도로명주소 검색API)는 공개된 초당 제한 수치가 없다. 그래서 고정값을
// 크게 잡지 않고 낮게 시작해 성공이 쌓일 때만 올린다. 429가 오면 즉시 절반이
// 되므로 실제 허용치는 실행 중에 스스로 찾는다.
export const NAVER_QPS_LIMIT = 10;
export const NAVER_DAILY_LIMIT = 25000;

export const UPSTREAM_DEFAULTS = Object.freeze({
  juso: Object.freeze({ start: 2, min: 1, max: 6, raiseAfter: 30, minIntervalMs: 0 }),
  // 1000/120 ≈ 8.3 QPS < 10 QPS
  naver: Object.freeze({ start: 2, min: 1, max: 4, raiseAfter: 40, minIntervalMs: 120 })
});

// refineAddress는 API 장애를 예외로 올리지 않고 SYSTEM_ERROR 결과로 돌려준다
// (app.js의 refineAddress 내부 catch). 그래서 예외만 보고 감속하면 장애가
// 계속되는 동안에도 성공으로 세어 동시 실행을 올리게 된다. 결과 상태로 판정한다.
export function isTransientOutcome(result) {
  const status = String(result?.status || "");
  if (status === "SYSTEM_ERROR") return true;
  return status === "FAILED" && result?.failKind === "TRANSIENT";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function createAdaptiveLimit(options = {}) {
  const { start, min, max, raiseAfter } = { ...DEFAULT_CONCURRENCY, ...options };
  let value = clamp(Math.floor(start), Math.max(1, min), Math.max(1, max));
  let streak = 0;
  let raised = 0;
  let lowered = 0;
  return {
    value: () => value,
    onSuccess() {
      streak += 1;
      if (streak >= raiseAfter && value < max) {
        streak = 0;
        value += 1;
        raised += 1;
      }
    },
    onTransient() {
      streak = 0;
      const next = Math.max(min, Math.floor(value / 2));
      if (next !== value) lowered += 1;
      value = next;
    },
    stats: () => ({ limit: value, streak, raised, lowered })
  };
}

// 원천별 호출 게이트.
//
// 행을 미리 분류해서 원천을 나누는 방식은 통하지 않는다. 지번이 있어도 JUSO가
// 0건이면 네이버로 넘어가기 때문이다(실측: 부산 기장군 만화리 271-8 부전타워는
// JUSO 2회 + 네이버 3회). 그래서 어느 풀에 넣든 네이버 호출량을 통제할 수 없고,
// 두 풀의 한도가 합쳐져 실제 네이버 동시 호출이 한도의 두 배가 된다.
//
// 통제는 호출 지점에서 한다. 클라이언트 함수를 감싸 원천별로 동시 실행 수와
// 호출 간격을 함께 제한한다. 그룹 풀은 작업을 흘려보내는 역할만 한다.
export function createUpstreamGate(options = {}) {
  const limit = createAdaptiveLimit(options);
  const minIntervalMs = Math.max(0, Number(options.minIntervalMs) || 0);
  let active = 0;
  let nextAllowedAt = 0;
  const waiting = [];

  const acquire = () => new Promise((resolve) => {
    const enter = () => {
      if (active < limit.value()) {
        active += 1;
        resolve();
      } else {
        waiting.push(enter);
      }
    };
    enter();
  });

  const release = () => {
    active -= 1;
    const next = waiting.shift();
    if (next) next();
  };

  return {
    limit,
    stats: () => ({ ...limit.stats(), active, waiting: waiting.length }),
    async run(call) {
      await acquire();
      try {
        // 동시 실행 수와 별개로 초당 호출 수도 막아야 한다. 한도가 1이어도
        // 응답이 빠르면 초당 수십 번이 나갈 수 있다.
        if (minIntervalMs > 0) {
          const now = Date.now();
          const wait = Math.max(0, nextAllowedAt - now);
          nextAllowedAt = Math.max(now, nextAllowedAt) + minIntervalMs;
          if (wait > 0) await new Promise((res) => setTimeout(res, wait));
        }
        const result = await call();
        limit.onSuccess();
        return result;
      } catch (error) {
        // 분류된 일시 오류만 감속 신호로 쓴다. 0건 응답은 오류가 아니다.
        if (error && error.transient) limit.onTransient();
        throw error;
      } finally {
        release();
      }
    }
  };
}

// 클라이언트 묶음을 원천별 게이트로 감싼다. 호출 규약은 그대로다.
export function gateClients(clients, gates) {
  const wrapped = { ...(clients || {}) };
  if (typeof clients?.juso === "function" && gates?.juso) {
    wrapped.juso = (...args) => gates.juso.run(() => clients.juso(...args));
  }
  if (typeof clients?.naverLocal === "function" && gates?.naver) {
    wrapped.naverLocal = (...args) => gates.naver.run(() => clients.naverLocal(...args));
  }
  return wrapped;
}

// 항목을 동시에 처리한다. worker는 스스로 오류를 처리해야 한다(현재 배치가
// try/catch로 일시오류를 결과값으로 바꾸는 구조를 그대로 유지하기 위함).
// worker가 던지면 전체를 중단하고 그 오류를 그대로 올린다.
export async function runAdaptivePool(items, worker, options = {}) {
  const source = Array.isArray(items) ? items : [];
  const { limit = createAdaptiveLimit(), shouldStop = () => false } = options;
  let cursor = 0;
  let active = 0;
  let started = 0;
  if (!source.length) return { started: 0, stopped: false };

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      if (error) reject(error);
      else resolve({ started, stopped: cursor < source.length });
    };
    const pump = () => {
      if (settled) return;
      if (shouldStop() || cursor >= source.length) {
        if (active === 0) finish(null);
        return;
      }
      while (active < limit.value() && cursor < source.length && !shouldStop()) {
        const index = cursor;
        cursor += 1;
        active += 1;
        started += 1;
        Promise.resolve()
          .then(() => worker(source[index], index))
          .then(
            () => {
              active -= 1;
              pump();
            },
            (error) => {
              active -= 1;
              finish(error);
            }
          );
      }
      // 한도가 0으로 내려가는 일은 없지만, 진행 중인 작업이 하나도 없는데
      // 새로 시작하지도 못하면 영원히 멈춘다. 그 상태를 방치하지 않는다.
      if (active === 0 && cursor < source.length && !shouldStop()) {
        finish(new Error("동시 실행 한도가 0이라 진행할 수 없습니다"));
      }
    };
    pump();
  });
}
