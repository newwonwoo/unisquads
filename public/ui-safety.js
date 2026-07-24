(() => {
  if (typeof window === "undefined" || !window.React || window.__ADDR_UI_SAFETY__) return;
  window.__ADDR_UI_SAFETY__ = true;

  const React = window.React;
  const originalCreateElement = React.createElement.bind(React);

  const STATUS_STYLE = {
    PASS: { color: "#86EFAC", border: "rgba(34,197,94,0.45)", background: "rgba(34,197,94,0.08)" },
    REVIEW: { color: "#FDE68A", border: "rgba(245,158,11,0.5)", background: "rgba(245,158,11,0.08)" },
    FAIL: { color: "#FCA5A5", border: "rgba(248,113,113,0.55)", background: "rgba(248,113,113,0.08)" },
    INFO: { color: "#7DD3FC", border: "rgba(56,189,248,0.4)", background: "rgba(56,189,248,0.07)" },
    NO_BASELINE: { color: "#94A3B8", border: "rgba(148,163,184,0.35)", background: "rgba(148,163,184,0.06)" }
  };

  const METRIC_LABELS = [
    ["confirmed_to_unconfirmed", "확정→미확정"],
    ["confirmed_pnu_changed", "PNU 변경"],
    ["building_management_no_changed", "건물관리번호 변경"],
    ["iros_unique_no_changed", "등기번호 변경"],
    ["iros_success_to_failure", "IROS 성공→실패"],
    ["newly_confirmed", "신규 확정"]
  ];

  function safeText(value, fallback = "") {
    if (value == null) return fallback;
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
      return String(value);
    }
    try {
      return JSON.stringify(value) || fallback;
    } catch {
      try {
        return String(value);
      } catch {
        return fallback;
      }
    }
  }

  function safeNumber(value) {
    try {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    } catch {
      return 0;
    }
  }

  function safeObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function sanitizeRegression(value) {
    const regression = safeObject(value);
    const metrics = safeObject(regression.metrics);
    const safeMetrics = {};
    for (const [key] of METRIC_LABELS) {
      const metric = safeObject(metrics[key]);
      const status = safeText(metric.status, "NO_BASELINE");
      safeMetrics[key] = {
        count: safeNumber(metric.count),
        status: STATUS_STYLE[status] ? status : "NO_BASELINE"
      };
    }
    const status = safeText(regression.status, "NO_BASELINE");
    return {
      ...regression,
      status: STATUS_STYLE[status] ? status : "NO_BASELINE",
      metrics: safeMetrics,
      changed_rows: Array.isArray(regression.changed_rows) ? regression.changed_rows : []
    };
  }

  function sanitizeRun(item, index) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const file = safeObject(item.file);
    const execution = safeObject(item.execution);
    const summary = safeObject(item.summary);
    const address = safeObject(summary.address);
    const iros = safeObject(summary.iros);
    return {
      ...item,
      id: safeText(item.id, `legacy-${index}`),
      phase: safeText(item.phase, "unknown"),
      started_at: safeText(item.started_at),
      updated_at: safeText(item.updated_at),
      reason: safeText(item.reason),
      file: {
        ...file,
        name: safeText(file.name, "브라우저 복원 작업")
      },
      execution: {
        ...execution,
        pipeline_version: safeText(execution.pipeline_version, "-")
      },
      summary: {
        ...summary,
        total_rows: safeNumber(summary.total_rows),
        address: {
          ...address,
          confirmed: safeNumber(address.confirmed),
          confirmed_rate: safeNumber(address.confirmed_rate)
        },
        iros: {
          ...iros,
          resolved: safeNumber(iros.resolved),
          eligible: safeNumber(iros.eligible),
          resolved_rate: safeNumber(iros.resolved_rate),
          multi: safeNumber(iros.multi),
          unit_not_found: safeNumber(iros.unit_not_found),
          validation_failed: safeNumber(iros.validation_failed)
        }
      },
      regression: item.regression ? sanitizeRegression(item.regression) : null
    };
  }

  function sanitizeLogs(logs) {
    return (Array.isArray(logs) ? logs : [])
      .map(sanitizeRun)
      .filter(Boolean)
      .slice(0, 30);
  }

  function RegressionBanner({ logs }) {
    const latest = Array.isArray(logs)
      ? logs.find((item) => item?.phase === "complete" && item?.regression)
      : null;
    if (!latest) return null;

    const regression = sanitizeRegression(latest.regression);
    const status = regression.status;
    const style = STATUS_STYLE[status] || STATUS_STYLE.NO_BASELINE;
    const metrics = regression.metrics;
    const changedCount = regression.changed_rows.length;

    return originalCreateElement("div", {
      style: {
        margin: "0 0 8px",
        padding: "10px 12px",
        borderRadius: 10,
        border: `1px solid ${style.border}`,
        background: style.background,
        color: "#E2E8F0"
      }
    },
    originalCreateElement("div", {
      style: { display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }
    },
    originalCreateElement("strong", { style: { fontSize: 12.5, color: style.color } },
      status === "NO_BASELINE" ? "회귀 비교 · 기준 실행 없음" : `회귀 비교 · ${status}`),
    originalCreateElement("span", { style: { fontSize: 10.5, color: "#94A3B8" } },
      status === "NO_BASELINE" ? "동일 파일을 한 번 더 완료하면 자동 비교" : `변경 행 ${changedCount}건`)),
    status === "NO_BASELINE" ? null : originalCreateElement("div", {
      style: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 7, fontSize: 10.5, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }
    }, ...METRIC_LABELS.map(([key, label]) => {
      const metric = metrics[key] || { count: 0, status: "NO_BASELINE" };
      const metricStyle = STATUS_STYLE[metric.status] || STATUS_STYLE.NO_BASELINE;
      return originalCreateElement("span", { key, style: { color: metric.count ? metricStyle.color : "#94A3B8" } }, `${label} ${metric.count}`);
    })));
  }

  function deleteTestLogKeysFromIndexedDb() {
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open("addr-refine", 1);
        req.onerror = () => resolve(false);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains("batch")) db.createObjectStore("batch", { keyPath: "key" });
        };
        req.onsuccess = () => {
          const db = req.result;
          try {
            const tx = db.transaction("batch", "readwrite");
            const store = tx.objectStore("batch");
            store.delete("addr-refine:test-runs:v1");
            store.delete("addr-refine:test-runs:active:v1");
            tx.oncomplete = () => {
              db.close();
              resolve(true);
            };
            tx.onerror = () => {
              db.close();
              resolve(false);
            };
          } catch {
            db.close();
            resolve(false);
          }
        };
      } catch {
        resolve(false);
      }
    });
  }

  class TestLogErrorBoundary extends React.Component {
    constructor(props) {
      super(props);
      this.state = { error: null, clearing: false };
    }

    static getDerivedStateFromError(error) {
      return { error };
    }

    componentDidCatch(error, info) {
      console.error("[addr-refine] test log panel render failed", error, info);
    }

    componentDidUpdate(prevProps) {
      if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
        this.setState({ error: null, clearing: false });
      }
    }

    async clearLogs() {
      if (this.state.clearing) return;
      this.setState({ clearing: true });
      let cleared = false;
      try {
        if (typeof this.props.onClear === "function") {
          await this.props.onClear();
          cleared = true;
        }
      } catch (error) {
        console.warn("[addr-refine] normal test-log clear failed", error);
      }
      if (!cleared) cleared = await deleteTestLogKeysFromIndexedDb();
      try {
        localStorage.removeItem("addr-refine:test-runs:v1");
        localStorage.removeItem("addr-refine:test-runs:active:v1");
      } catch {
        // ignore
      }
      if (cleared) {
        this.setState({ error: null, clearing: false });
        setTimeout(() => location.reload(), 0);
        return;
      }
      this.setState({ clearing: false });
    }

    render() {
      if (!this.state.error) return this.props.children;
      const errorText = safeText(this.state.error?.message || this.state.error, "알 수 없는 렌더 오류");
      return originalCreateElement("div", {
        style: {
          margin: "0 0 14px",
          padding: 16,
          borderRadius: 13,
          background: "rgba(15,19,28,0.94)",
          border: "1px solid rgba(248,113,113,0.55)",
          color: "#F8FAFC"
        }
      },
      originalCreateElement("div", { style: { fontSize: 14, fontWeight: 800 } }, "테스트 로그를 열 수 없습니다"),
      originalCreateElement("div", { style: { marginTop: 6, fontSize: 12, color: "#CBD5E1", lineHeight: 1.6 } },
        "구버전 또는 손상된 테스트 로그를 안전하게 정리한 뒤 다시 불러옵니다. 앱 자체는 계속 사용할 수 있습니다."),
      originalCreateElement("div", {
        style: {
          marginTop: 8,
          padding: "7px 9px",
          borderRadius: 7,
          background: "rgba(2,6,23,0.55)",
          color: "#94A3B8",
          fontSize: 10.5,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          wordBreak: "break-word"
        }
      }, errorText),
      originalCreateElement("button", {
        onClick: () => this.clearLogs(),
        disabled: this.state.clearing,
        style: {
          marginTop: 10,
          padding: "7px 11px",
          borderRadius: 8,
          border: "1px solid rgba(248,113,113,0.65)",
          background: "transparent",
          color: "#FCA5A5",
          cursor: this.state.clearing ? "default" : "pointer",
          opacity: this.state.clearing ? 0.6 : 1
        }
      }, this.state.clearing ? "초기화 중…" : "테스트 로그 초기화"));
    }
  }

  function SafeTestLogPanel({ originalType, originalProps }) {
    const safeLogs = sanitizeLogs(originalProps?.logs);
    const safeProps = { ...(originalProps || {}), logs: safeLogs };
    const resetKey = safeLogs.map((run) => `${run.id}:${run.updated_at}`).join("|").slice(0, 500);
    return originalCreateElement(
      TestLogErrorBoundary,
      { onClear: safeProps.onClear, resetKey, key: resetKey || "empty" },
      originalCreateElement(React.Fragment, null,
        originalCreateElement(RegressionBanner, { logs: safeLogs }),
        originalCreateElement(originalType, safeProps)
      )
    );
  }

  React.createElement = function patchedCreateElement(type, props, ...children) {
    if (typeof type === "function" && type.name === "TestLogPanel") {
      return originalCreateElement(SafeTestLogPanel, {
        originalType: type,
        originalProps: props || {}
      });
    }
    return originalCreateElement(type, props, ...children);
  };
})();
