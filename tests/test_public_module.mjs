import test from "node:test";

test("deployed browser module links without executing the UI", async () => {
  globalThis.window = { storage: {} };
  globalThis.React = { createElement() { return {}; } };
  globalThis.ReactDOM = {
    createRoot() {
      return { render() {} };
    }
  };
  globalThis.document = { getElementById() { return {}; } };

  await import("../public/app.js");
});
