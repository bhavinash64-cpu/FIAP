import { Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

/**
 * Last-resort boundary. If anything throws during startup or the first render
 * (a misconfigured backend, a bad chunk), show a plain, self-contained message
 * instead of a blank white page — the failure mode that made a missing env var
 * on the host look like "nothing loads". Deliberately dependency-free so it
 * renders even when the app's own modules are the thing that failed.
 */
class RootBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error("Application failed to start:", error);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, background: "#FAFAF9", color: "#1A1A1A", fontFamily: "Inter, system-ui, sans-serif" }}>
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em" }}>Something went wrong while loading</div>
          <p style={{ marginTop: 8, fontSize: 14, lineHeight: 1.6, color: "#5B6170" }}>
            The application could not start. Please reload the page. If this keeps happening, the platform may be
            temporarily unavailable.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: 20, height: 44, padding: "0 20px", borderRadius: 12, border: 0, background: "#5B4CF7", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}

createRoot(document.getElementById("root")!).render(
  <RootBoundary>
    <App />
  </RootBoundary>,
);
