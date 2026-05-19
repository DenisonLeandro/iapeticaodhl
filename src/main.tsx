import { createRoot } from "react-dom/client";
import { lazy, Suspense } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { getBackendConfigStatus } from "./lib/backend/client";
import "./index.css";

const root = createRoot(document.getElementById("root")!);

function BootError() {
  // Triggers ErrorBoundary fallback (shows config-aware message).
  throw new Error("Backend not configured");
}

if (getBackendConfigStatus() !== "ok") {
  root.render(
    <ErrorBoundary>
      <BootError />
    </ErrorBoundary>
  );
} else {
  const App = lazy(() => import("./App"));
  root.render(
    <ErrorBoundary>
      <Suspense fallback={null}>
        <App />
      </Suspense>
    </ErrorBoundary>
  );
}
