export const BATCH_UI_FLUSH_INTERVAL_MS = 500;
export const BATCH_CHECKPOINT_INTERVAL_MS = 5_000;

export function shouldFlushBatchUi({
  hidden = false,
  now = Date.now(),
  lastFlushAt = 0,
  force = false
} = {}) {
  if (hidden) return false;
  return force || now - lastFlushAt >= BATCH_UI_FLUSH_INTERVAL_MS;
}

export function shouldPersistBatchCheckpoint({
  now = Date.now(),
  lastCheckpointAt = 0,
  force = false
} = {}) {
  return force || now - lastCheckpointAt >= BATCH_CHECKPOINT_INTERVAL_MS;
}

export function browserTabHidden(doc = globalThis.document) {
  return Boolean(doc && doc.visibilityState === "hidden");
}
