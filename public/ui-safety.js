(() => {
  if (typeof window === "undefined" || !window.React || window.__ADDR_UI_SAFETY__) return;
  window.__ADDR_UI_SAFETY__ = true;

  const React = window.React;
  const originalCreateElement = React.createElement.bind(React);

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
        const dbRequest = indexedDB.open("addr-refine-db");
        dbRequest.onsuccess = () => {
          try {
            const db = dbRequest.result;
            for (const storeName of Array.from(db.objectStoreNames || [])) {
              const tx = db.transaction(storeName, "readwrite");
              const store = tx.objectStore(storeName);
              store.delete("addr-refine:test-runs:v1");
              store.delete("addr-refine:test-runs:active:v1");
            }
          } catch (error) {
            console.warn("[addr-refine] failed to clear IndexedDB test logs", error);
          }
        };
      } catch (error) {
        console.warn("[addr-refine] failed to open IndexedDB", error);
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
      null,
      originalCreateElement(originalType, safeProps)
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
