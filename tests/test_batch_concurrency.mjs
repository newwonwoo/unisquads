import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DEFAULT_CONCURRENCY,
  createAdaptiveLimit,
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
  assert.ok(source.includes("runAdaptivePool([...groups.values()]"));
  assert.ok(source.includes("shouldStop: () => batchStopRef.current"));
  assert.ok(source.includes("concurrency.onSuccess()"));
  assert.ok(source.includes("concurrency.onTransient()"));
  // 전파는 모든 조회가 끝난 뒤에 돌아야 한다(순서 의존).
  const pool = source.indexOf("runAdaptivePool([...groups.values()]");
  const propagate = source.indexOf("propagateAddressGroup(next, groupHints, evidenceFor)");
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

test("감속과 연속실패 집계가 한 곳에서 결정된다", async () => {
  const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  assert.ok(source.includes("if (isTransientOutcome(r)) {"));
  assert.ok(source.includes("consecTransient += 1;\n        concurrency.onTransient();"));
  assert.ok(source.includes("consecTransient = 0;\n        concurrency.onSuccess();"));
  // 성공/실패 신호가 try/catch 안에 흩어져 있으면 장애를 성공으로 센다.
  const body = source.slice(source.indexOf("runAdaptivePool([...groups.values()]"));
  assert.equal((body.match(/concurrency\.onSuccess\(\)/g) || []).length, 1);
  assert.equal((body.match(/concurrency\.onTransient\(\)/g) || []).length, 1);
});
