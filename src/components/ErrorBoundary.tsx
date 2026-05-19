import React from "react";
import { getBackendConfigStatus } from "@/lib/backend/client";
import type { BackendConfigStatus } from "@/lib/backend/client";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}

function ErrorFallback({ error }: { error: Error | null }) {
  const configStatus: BackendConfigStatus = getBackendConfigStatus();
  const isConfigError = configStatus !== "ok";

  const configDetail =
    configStatus === "missing_url"
      ? "URL do backend não encontrada."
      : configStatus === "missing_key"
        ? "Chave pública do backend não encontrada."
        : null;

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#f8fafc",
      fontFamily: "system-ui, -apple-system, sans-serif",
      padding: "2rem",
    }}>
      <div style={{
        maxWidth: 480,
        textAlign: "center",
        background: "#fff",
        borderRadius: 12,
        padding: "2.5rem 2rem",
        boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1e293b", margin: "0 0 12px" }}>
          {isConfigError ? "Erro de Configuração" : "Algo deu errado"}
        </h1>
        <p style={{ fontSize: 15, color: "#64748b", lineHeight: 1.6, margin: "0 0 12px" }}>
          {isConfigError
            ? configDetail
            : "Ocorreu um erro inesperado na aplicação."}
        </p>
        <p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 24px" }}>
          {isConfigError
            ? "Isso geralmente se resolve ao recarregar a página. Se persistir, entre em contato com o suporte."
            : "Tente recarregar a página."}
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "10px 28px",
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Recarregar página
        </button>
      </div>
    </div>
  );
}

export function checkEnvVars(): boolean {
  return getBackendConfigStatus() === "ok";
}
