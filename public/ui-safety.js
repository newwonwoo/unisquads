(() => {
  if (typeof window === "undefined" || !window.React || window.__ADDR_UI_SAFETY__) return;
  window.__ADDR_UI_SAFETY__ = true;

  const React = window.React;
  const originalCreateElement = React.createElement.bind(React);

  const STATUS_STYLE = {
    PASS: { color: "#86EFAC", border: "rgba(34,197,94,0.45)", background: "rgba(34,197,94,0.08)" },
    REVIEW: { color: "#FDE68A", border: "rgba(245,158,11,0.5)", background: "rgba(245,158,11,0.08)" },
    FAIL: { color: "#FCA5A5", border: "rgba(248,113,113,0.55)", background: "rgba(248,113,113,0.08)" },
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

  function RegressionBanner({ logs }) {
    const latest = Array.isArray(logs)
      ? logs.find((item) => item?.phase === "complete" && item?.regression)
      : null;
    if (!latest) return null;

    const regression = latest.regression || {};
    const status = regression.status || "NO_BASELINE";
    const style = STATUS_STYLE[status] || STATUS_STYLE.NO_BASELINE;
    const metrics = regression.metrics || {};
    const changedCount = Array.isArray(regression.changed_rows) ? regression.changed_rows.length : 0;

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
      const metric = metrics[key] || {};
      const count = Number(metric.count || 0);
      const metricStyle = STATUS_STYLE[metric.status] || STATUS_STYLE.NO_BASELINE;
      return originalCreateElement("span", { key, style: { color: count ? metricStyle.color : "#94A3B8" } }, `${label} ${count}`);
    })));
  }

  class TestLogErrorBoundary extends React.Component {
    constructor(props) {
      super(props);
      this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
      return { error };
    }

    componentDidCatch(error, info) {
      console.error("[addr-refine] test log panel render failed", error, info);
    }

    async clearLogs() {
      try {
        if (typeof this.props.onClear === "function") {
          await this.props.onClear();
          return;
        }
      } catch (error) {
        console.warn("[addr-refine] normal test-log clear failed", error);
      }
      try {
        localStorage.removeItem("addr-refine:test-runs:v1");
        localStorage.removeItem("addr-refine:test-runs:active:v1");
      } catch {
        // ignore
      }
      location.reload();
    }

    render() {
      if (!this.state.error) return this.props.children;
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
        "구버전 또는 손상된 테스트 로그가 포함돼 있습니다. 앱 자체는 계속 사용할 수 있습니다."),
      originalCreateElement("button", {
        onClick: () => this.clearLogs(),
        style: {
          marginTop: 10,
          padding: "7px 11px",
          borderRadius: 8,
          border: "1px solid rgba(248,113,113,0.65)",
          background: "transparent",
          color: "#FCA5A5",
          cursor: "pointer"
        }
      }, "테스트 로그 초기화"));
    }
  }

  function SafeTestLogPanel({ originalType, originalProps }) {
    const safeLogs = Array.isArray(originalProps?.logs)
      ? originalProps.logs.filter((item) => item && typeof item === "object")
      : [];
    const safeProps = { ...(originalProps || {}), logs: safeLogs };
    return originalCreateElement(
      TestLogErrorBoundary,
      { onClear: safeProps.onClear },
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
