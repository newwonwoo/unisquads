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
