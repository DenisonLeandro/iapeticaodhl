// =============================================================================
// Tests — DocumentWizard (integration)
// Story 2.2 — Document Generation Flow
// =============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { screen, fireEvent, waitFor } from "@testing-library/dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import DocumentWizard from "@/components/ai/DocumentWizard";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
    profile: { id: "user-1", full_name: "Test User" },
    organization: { id: "org-1", name: "Test Org" },
  }),
}));

const mockGenerate = vi.fn();
const mockReset = vi.fn();
vi.mock("@/hooks/useDocumentGeneration", () => ({
  useDocumentGeneration: () => ({
    generate: mockGenerate,
    document: null,
    isGenerating: false,
    error: null,
    status: "idle",
    reset: mockReset,
  }),
}));

const mockCreateDocument = vi.fn();
vi.mock("@/hooks/useDocuments", () => ({
  useCreateDocument: () => ({
    mutateAsync: mockCreateDocument,
    isPending: false,
  }),
  useLogAIUsage: () => ({
    mutate: vi.fn(),
  }),
}));

function renderWizard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DocumentWizard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DocumentWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders stepper with 3 steps", () => {
    renderWizard();
    expect(screen.getByText("Tipo")).toBeInTheDocument();
    expect(screen.getByText("Dados")).toBeInTheDocument();
    expect(screen.getByText("Resultado")).toBeInTheDocument();
  });

  it("starts on step 1 with disabled next button", () => {
    renderWizard();
    expect(screen.getByText("Tipo de Documento")).toBeInTheDocument();
    const nextButton = screen.getByText("Próximo");
    expect(nextButton.closest("button")).toBeDisabled();
  });

  it("enables next button after selecting a document type", () => {
    renderWizard();
    fireEvent.click(screen.getByText("Petição Inicial"));
    const nextButton = screen.getByText("Próximo");
    expect(nextButton.closest("button")).not.toBeDisabled();
  });

  it("navigates to step 2 when clicking next after type selection", async () => {
    renderWizard();
    fireEvent.click(screen.getByText("Petição Inicial"));
    fireEvent.click(screen.getByText("Próximo"));
    await waitFor(() => {
      expect(screen.getByText("Dados do Documento")).toBeInTheDocument();
    });
  });

  it("goes back to step 1 when clicking back on step 2", async () => {
    renderWizard();
    fireEvent.click(screen.getByText("Petição Inicial"));
    fireEvent.click(screen.getByText("Próximo"));
    await waitFor(() => {
      expect(screen.getByText("Dados do Documento")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Voltar"));
    await waitFor(() => {
      expect(screen.getByText("Tipo de Documento")).toBeInTheDocument();
    });
  });
});
