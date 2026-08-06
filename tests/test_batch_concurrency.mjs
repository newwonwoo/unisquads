import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DEFAULT_CONCURRENCY,
  JUSO_OFFICIAL_RATE,
  NAVER_QPS_LIMIT,
  UPSTREAM_DEFAULTS,
  createAdaptiveLimit,
  createUpstreamGate,
  gateClients,
  isTransientOutcome,
  runAdaptivePool
} from "../public/batch-concurrency.mjs";

const tick = (ms = 0) => new Promise((res) => setTimeout(res, ms));

test("한도는 천천히 오르고 즉시 내린다", () => {
  const limit = createAdaptiveLimit({ start: 4, min: 1, max: 6, raiseAfter: 3 });
  assert.equal(limit.value(), 4);
  limit.onSuccess(); limit.onSuccess();
  assert.equal(limit.value(), 4, "아직 연속 성공이 모자라면 그대로");
  limit.onSuccess();
  assert.equal(limit.value(), 5, "연속 성공이 차면 한 단계만 오른다");

  limit.onTransient();
  assert.equal(limit.value(), 2, "일시 오류는 즉시 절반");
  limit.onTransient();
  assert.equal(limit.value(), 1);
  limit.onTransient();
  assert.equal(limit.value(), 1, "최소 아래로는 내려가지 않는다");
});

test("한도는 최대치를 넘지 않고 성공 연속은 오류로 끊긴다", () => {
  const limit = createAdaptiveLimit({ start: 5, min: 1, max: 5, raiseAfter: 1 });
  for (let i = 0; i < 10; i++) limit.onSuccess();
  assert.equal(limit.value(), 5);

  const other = createAdaptiveLimit({ start: 4, min: 1, max: 8, raiseAfter: 3 });
  other.onSuccess(); other.onSuccess();
  other.onTransient();          // 연속 성공 초기화 + 절반
  other.onSuccess(); other.onSuccess();
  assert.equal(other.value(), 2, "끊긴 뒤에는 다시 처음부터 쌓아야 한다");
});

test("동시 실행 수가 한도를 넘지 않는다", async () => {
  const limit = createAdaptiveLimit({ start: 3, min: 1, max: 3, raiseAfter: 1000 });
  let active = 0;
  let peak = 0;
  await runAdaptivePool(Array.from({ length: 30 }, (_, i) => i), async () => {
    active += 1;
    peak = Math.max(peak, active);
    await tick(1);
    active -= 1;
  }, { limit });
  assert.equal(peak, 3);
  assert.equal(active, 0);
});

test("완료 순서와 무관하게 모든 항목이 정확히 한 번 처리된다", async () => {
  const items = Array.from({ length: 50 }, (_, i) => i);
  const seen = [];
  await runAdaptivePool(items, async (item) => {
    // 일부러 완료 순서를 뒤섞는다.
    await tick(item % 5);
    seen.push(item);
  }, { limit: createAdaptiveLimit({ start: 8, min: 1, max: 8 }) });
  assert.equal(seen.length, items.length);
  assert.deepEqual([...seen].sort((a, b) => a - b), items);
});

test("중단 신호가 오면 새 작업을 시작하지 않는다", async () => {
  let processed = 0;
  let stop = false;
  await runAdaptivePool(Array.from({ length: 100 }, (_, i) => i), async () => {
    processed += 1;
    if (processed >= 10) stop = true;
    await tick(1);
  }, { limit: createAdaptiveLimit({ start: 2, min: 1, max: 2 }), shouldStop: () => stop });
  assert.equal(processed < 100, true);
  assert.equal(processed >= 10, true);
});

test("worker가 던지면 전체가 그 오류로 끝난다", async () => {
  await assert.rejects(
    runAdaptivePool([1, 2, 3], async (item) => {
      await tick(1);
      if (item === 2) throw new Error("작업 실패");
    }, { limit: createAdaptiveLimit({ start: 2, min: 1, max: 2 }) }),
    /작업 실패/
  );
});

test("빈 목록과 기본값은 그대로 통과한다", async () => {
  assert.deepEqual(await runAdaptivePool([], async () => {}), { started: 0, stopped: false });
  assert.deepEqual(await runAdaptivePool(null, async () => {}), { started: 0, stopped: false });
  assert.equal(createAdaptiveLimit().value(), DEFAULT_CONCURRENCY.start);
});

test("주소 배치가 그룹을 동시 처리하도록 연결됐다", async () => {
  const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  assert.ok(source.includes("runAdaptivePool("));
  assert.ok(source.includes("shouldStop: () => batchStopRef.current"));
  // 전파는 모든 조회가 끝난 뒤에 돌아야 한다(순서 의존).
  const pool = source.indexOf("const processGroup = async (idxs)");
  const propagate = source.indexOf("propagateAddressGroup(next, groupHints, evidenceFor)");
  assert.notEqual(pool, -1);
  assert.equal(pool < propagate, true);
  // 체크포인트 시각은 저장 전에 올려야 중복 저장이 겹치지 않는다.
  assert.ok(source.includes("lastCheckpointAt = now;\n        if (!hidden) setRows([...next]);"));
});

test("장애 신호는 예외가 아니라 결과 상태로 판정한다", () => {
  // refineAddress는 API 장애를 예외로 올리지 않고 SYSTEM_ERROR 결과로 준다.
  // 예외만 보고 감속하면 장애 중에도 성공으로 세어 동시 실행을 올린다.
  assert.equal(isTransientOutcome({ status: "SYSTEM_ERROR" }), true);
  assert.equal(isTransientOutcome({ status: "FAILED", failKind: "TRANSIENT" }), true);
  assert.equal(isTransientOutcome({ status: "FAILED", failKind: "PERMANENT" }), false);
  assert.equal(isTransientOutcome({ status: "CONFIRMED" }), false);
  assert.equal(isTransientOutcome({ status: "AMBIGUOUS" }), false);
  assert.equal(isTransientOutcome(null), false);
  assert.equal(isTransientOutcome({}), false);
});

test("장애가 이어지면 한도가 최소까지 떨어진다", () => {
  const limit = createAdaptiveLimit({ start: 12, min: 1, max: 12, raiseAfter: 25 });
  const outcome = { status: "SYSTEM_ERROR" };
  for (let i = 0; i < 6; i++) {
    if (isTransientOutcome(outcome)) limit.onTransient();
    else limit.onSuccess();
  }
  assert.equal(limit.value(), 1, "장애가 계속되면 직렬까지 내려간다");
  assert.equal(limit.stats().raised, 0, "장애 중에는 한 번도 올라가지 않는다");
});

test("자동중단용 연속 실패는 결과 상태로 센다", async () => {
  const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  // refineAddress는 장애를 예외가 아니라 SYSTEM_ERROR 결과로 돌려준다.
  assert.ok(source.includes("if (isTransientOutcome(r)) consecTransient += 1;"));
  assert.ok(source.includes("else consecTransient = 0;"));
  // 감속은 게이트가 호출 단위로 한다. 행 단위 중복 신호가 남으면 안 된다.
  const body = source.slice(source.indexOf("const processGroup = async (idxs)"));
  assert.equal((body.match(/concurrency\.on(Success|Transient)\(\)/g) || []).length, 0);
});


test("네이버 게이트는 공식 초당 제한 아래로 호출 간격을 유지한다", () => {
  // 공식: 초당 10회. 간격 120ms → 상한 약 8.3 QPS.
  const naver = UPSTREAM_DEFAULTS.naver;
  assert.equal(1000 / naver.minIntervalMs < NAVER_QPS_LIMIT, true);
  assert.equal(naver.minIntervalMs >= 100, true, "100ms 미만이면 10 QPS를 넘는다");
});

test("게이트가 동시 실행 수와 호출 간격을 함께 지킨다", async () => {
  const gate = createUpstreamGate({ start: 2, min: 1, max: 2, minIntervalMs: 40 });
  let active = 0;
  let peak = 0;
  const starts = [];
  await Promise.all(Array.from({ length: 6 }, () => gate.run(async () => {
    starts.push(Date.now());
    active += 1; peak = Math.max(peak, active);
    await tick(5);
    active -= 1;
  })));
  assert.equal(peak <= 2, true, "동시 실행 수 상한을 지킨다");
  const gaps = starts.slice(1).map((t, i) => t - starts[i]);
  // 간격 제한이 없으면 6건이 거의 동시에 시작한다.
  assert.equal(starts[starts.length - 1] - starts[0] >= 40 * 4, true, "호출 간격을 벌린다");
});

test("게이트는 일시 오류에만 감속하고 0건 응답은 성공으로 본다", async () => {
  const gate = createUpstreamGate({ start: 4, min: 1, max: 4, raiseAfter: 1000 });
  await gate.run(async () => []);            // 0건 = 정상 응답
  assert.equal(gate.limit.value(), 4);

  const transient = Object.assign(new Error("HTTP 429"), { transient: true });
  await assert.rejects(gate.run(async () => { throw transient; }));
  assert.equal(gate.limit.value(), 2, "일시 오류만 절반으로 줄인다");

  await assert.rejects(gate.run(async () => { throw new Error("일반 오류"); }));
  assert.equal(gate.limit.value(), 2, "분류되지 않은 오류는 감속하지 않는다");
});

test("게이트를 씌워도 클라이언트 호출 규약은 그대로다", async () => {
  const calls = [];
  const clients = {
    juso: async (kw) => { calls.push(["juso", kw]); return [{ ok: 1 }]; },
    naverLocal: async (kw) => { calls.push(["naver", kw]); return []; },
    other: "그대로"
  };
  const gates = { juso: createUpstreamGate({ start: 2 }), naver: createUpstreamGate({ start: 2 }) };
  const gated = gateClients(clients, gates);
  assert.deepEqual(await gated.juso("역삼동 1"), [{ ok: 1 }]);
  assert.deepEqual(await gated.naverLocal("부전타워"), []);
  assert.deepEqual(calls, [["juso", "역삼동 1"], ["naver", "부전타워"]]);
  assert.equal(gated.other, "그대로");
  // 게이트가 없으면 원본을 그대로 돌려준다.
  assert.equal(gateClients(clients, {}).juso, clients.juso);
});

test("배치가 행 분류가 아니라 호출 지점에서 제한한다", async () => {
  const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  assert.ok(source.includes("gateClients(clients, gates)"));
  assert.ok(source.includes("refineAddress(next[idxs[0]].raw, gatedClients"));
  assert.ok(source.includes("createUpstreamGate(UPSTREAM_DEFAULTS.juso)"));
  assert.ok(source.includes("createUpstreamGate(UPSTREAM_DEFAULTS.naver)"));
  // 지번 유무로 행을 나누던 방식은 네이버 승격을 잡지 못해 폐기했다.
  assert.equal(source.includes('preprocess(next[idxs[0]].raw || "").jibun ? "juso" : "naver"'), false);
  assert.equal(source.includes("byUpstream"), false);
});

test("JUSO 한도는 공식 제한 수치를 근거로만 바꾼다", () => {
  // 공식: 5초에 10건(2 QPS). 지금 값은 그 총량 계산과 맞지 않지만, 운영
  // 이력상 그 이상으로 오래 돌려도 차단된 적이 없다. 관측만 보고 올리면
  // 과거 한 번 48배까지 올리려 한 적이 있으므로 상한을 못박아 둔다.
  assert.equal(JUSO_OFFICIAL_RATE.requests, 10);
  assert.equal(JUSO_OFFICIAL_RATE.perSeconds, 5);
  const juso = UPSTREAM_DEFAULTS.juso;
  assert.equal(juso.max <= 6, true, "실측 근거 없이 상한을 올리지 않는다");
  assert.equal(juso.start <= juso.max, true);
  assert.equal(juso.min >= 1, true);
});

test("네이버 간격은 성능 사유로 낮출 수 없다", () => {
  // 공식 제한이라 튜닝 대상이 아니다.
  assert.equal(UPSTREAM_DEFAULTS.naver.minIntervalMs >= 1000 / NAVER_QPS_LIMIT, true);
});

test("실행 중 한도를 밖에서 확인할 수 있다", async () => {
  const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  assert.ok(source.includes("window.__ADDR_GATE_STATS__"));
  assert.ok(source.includes("juso: gates.juso.stats()"));
  assert.ok(source.includes("naver: gates.naver.stats()"));

  // stats가 한도와 대기열을 실제로 담아야 진단에 쓸 수 있다.
  const gate = createUpstreamGate({ start: 3, min: 1, max: 5 });
  const stats = gate.stats();
  assert.equal(stats.limit, 3);
  assert.equal(stats.active, 0);
  assert.equal(stats.waiting, 0);
  assert.equal(typeof stats.raised, "number");
  assert.equal(typeof stats.lowered, "number");
});
