import assert from "node:assert/strict";
import test from "node:test";

import {
  BATCH_CHECKPOINT_INTERVAL_MS,
  BATCH_UI_FLUSH_INTERVAL_MS,
  browserTabHidden,
  shouldFlushBatchUi,
  shouldPersistBatchCheckpoint
} from "../public/batch-runtime-guard.mjs";

test("hidden tabs never request a React progress repaint", () => {
  assert.equal(shouldFlushBatchUi({ hidden: true, now: 10_000, lastFlushAt: 0 }), false);
  assert.equal(shouldFlushBatchUi({ hidden: true, force: true }), false);
});

test("visible progress repaints are rate limited", () => {
  assert.equal(shouldFlushBatchUi({ hidden: false, now: BATCH_UI_FLUSH_INTERVAL_MS - 1, lastFlushAt: 0 }), false);
  assert.equal(shouldFlushBatchUi({ hidden: false, now: BATCH_UI_FLUSH_INTERVAL_MS, lastFlushAt: 0 }), true);
  assert.equal(shouldFlushBatchUi({ hidden: false, now: 1, lastFlushAt: 1, force: true }), true);
});

test("durable checkpoints continue while the tab is hidden", () => {
  assert.equal(shouldPersistBatchCheckpoint({ now: BATCH_CHECKPOINT_INTERVAL_MS - 1, lastCheckpointAt: 0 }), false);
  assert.equal(shouldPersistBatchCheckpoint({ now: BATCH_CHECKPOINT_INTERVAL_MS, lastCheckpointAt: 0 }), true);
  assert.equal(shouldPersistBatchCheckpoint({ now: 1, lastCheckpointAt: 1, force: true }), true);
});

test("visibility helper only treats hidden as background", () => {
  assert.equal(browserTabHidden({ visibilityState: "hidden" }), true);
  assert.equal(browserTabHidden({ visibilityState: "visible" }), false);
  assert.equal(browserTabHidden(null), false);
});
