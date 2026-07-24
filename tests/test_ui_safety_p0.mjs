import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

function loadSafety() {
  class Component {
    constructor(props) {
      this.props = props || {};
      this.state = {};
    }
    setState(patch, callback) {
      const next = typeof patch === "function" ? patch(this.state, this.props) : patch;
      this.state = { ...this.state, ...(next || {}) };
      if (callback) callback();
    }
  }

  const originalCreateElement = (type, props, ...children) => ({
    type,
    props: { ...(props || {}), children }
  });
  const React = {
    Component,
    Fragment: Symbol("Fragment"),
    createElement: originalCreateElement
  };
  let reloads = 0;
  const context = {
    window: { React },
    React,
    console,
    JSON,
    Number,
    String,
    indexedDB: {},
    localStorage: { removeItem() {} },
    location: { reload() { reloads += 1; } },
    setTimeout(callback) { callback(); },
    clearTimeout() {},
    Promise
  };
  vm.runInNewContext(fs.readFileSync(new URL("../public/ui-safety.js", import.meta.url), "utf8"), context);
  return { React, reloads: () => reloads };
}

test("malformed legacy log values are converted to render-safe primitives", () => {
  const { React } = loadSafety();
  function TestLogPanel() { return null; }

  const patchedElement = React.createElement(TestLogPanel, {
    logs: [{
      id: { legacy: 1 },
      phase: { bad: true },
      started_at: { value: "old" },
      file: { name: { nested: "file" } },
      execution: { pipeline_version: { version: 7 } },
      summary: {
        total_rows: "20",
        address: { confirmed: "18", confirmed_rate: "0.9" },
        iros: { eligible: "10", resolved: "9", resolved_rate: "0.9" }
      },
      regression: {
        status: { bad: true },
        metrics: { confirmed_to_unconfirmed: { count: "2", status: "FAIL" } },
        changed_rows: null
      }
    }]
  });

  const boundaryElement = patchedElement.type(patchedElement.props);
  const fragmentElement = boundaryElement.props.children[0];
  const panelElement = fragmentElement.props.children[1];
  const [safeRun] = panelElement.props.logs;

  assert.equal(typeof safeRun.id, "string");
  assert.equal(typeof safeRun.phase, "string");
  assert.equal(typeof safeRun.file.name, "string");
  assert.equal(typeof safeRun.execution.pipeline_version, "string");
  assert.equal(safeRun.summary.total_rows, 20);
  assert.equal(safeRun.summary.address.confirmed, 18);
  assert.equal(safeRun.regression.status, "NO_BASELINE");
  assert.equal(Array.isArray(safeRun.regression.changed_rows), true);
  assert.equal(safeRun.regression.changed_rows.length, 0);
});

test("error-boundary reset clears the latched error and reloads", async () => {
  const { React, reloads } = loadSafety();
  function TestLogPanel() { return null; }
  let cleared = 0;
  const patchedElement = React.createElement(TestLogPanel, {
    logs: [],
    onClear: async () => { cleared += 1; }
  });
  const boundaryElement = patchedElement.type(patchedElement.props);
  const Boundary = boundaryElement.type;
  const instance = new Boundary(boundaryElement.props);
  instance.state = { error: new Error("broken"), clearing: false };

  await instance.clearLogs();

  assert.equal(cleared, 1);
  assert.equal(instance.state.error, null);
  assert.equal(instance.state.clearing, false);
  assert.equal(reloads(), 1);
});
