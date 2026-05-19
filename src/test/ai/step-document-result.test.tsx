// =============================================================================
// Tests — StepDocumentResult (Step 3)
// Story 2.2 — Document Generation Flow
// =============================================================================

import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { screen, fireEvent } from "@testing-library/dom";
import StepDocumentResult from "@/components/ai/steps/StepDocumentResult";
import type { GeneratedDocument } from "@/types/ai";

// Mock export functions
vi.mock("@/lib/pdf/export-document", () => ({
  exportDocumentToPDF: vi.fn().mockResolvedValue(new Blob()),
}));
vi.mock("@/lib/docx/export-document", () => ({
  exportDocumentToDOCX: vi.fn().mockResolvedValue(new Blob()),
}));
vi.mock("@/lib/document-parser", () => ({
  downloadBlob: vi.fn(),
}));

const mockDocument: GeneratedDocument = {
  content: "EXMO. SR. JUIZ DE DIREITO DA 2a VARA CÍVEL...\n\nPetição inicial gerada por IA.",
  tokensUsed: { input: 500, output: 1200 },
  model: "gpt-4o-mini",
  provider: "openai",
};

describe("StepDocumentResult", () => {
  it("shows loading state when generating", () => {
    render(
      <StepDocumentResult
        isGenerating={true}
        generatedDocument={null}
        error={null}
        isSaving={false}
        isSaved={false}
        onSave={vi.fn()}
        onEdit={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("Gerando documento...")).toBeInTheDocument();
    expect(
      screen.getByText(/pode levar de 15 a 30 segundos/),
    ).toBeInTheDocument();
  });

  it("shows error state with retry button", () => {
    const onRetry = vi.fn();
    render(
      <StepDocumentResult
        isGenerating={false}
        generatedDocument={null}
        error={new Error("Falha na geração")}
        isSaving={false}
        isSaved={false}
        onSave={vi.fn()}
        onEdit={vi.fn()}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText("Erro na geração")).toBeInTheDocument();
    expect(screen.getByText("Falha na geração")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Tentar novamente"));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("displays generated document content", () => {
    render(
      <StepDocumentResult
        isGenerating={false}
        generatedDocument={mockDocument}
        error={null}
        isSaving={false}
        isSaved={false}
        onSave={vi.fn()}
        onEdit={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("Documento Gerado")).toBeInTheDocument();
    expect(screen.getByTestId("generated-content")).toHaveTextContent(
      "Petição inicial gerada por IA",
    );
  });

  it("shows model and token badges", () => {
    render(
      <StepDocumentResult
        isGenerating={false}
        generatedDocument={mockDocument}
        error={null}
        isSaving={false}
        isSaved={false}
        onSave={vi.fn()}
        onEdit={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("openai / gpt-4o-mini")).toBeInTheDocument();
    expect(screen.getByText("1700 tokens")).toBeInTheDocument();
  });

  it("calls onSave when clicking Salvar Rascunho", () => {
    const onSave = vi.fn();
    render(
      <StepDocumentResult
        isGenerating={false}
        generatedDocument={mockDocument}
        error={null}
        isSaving={false}
        isSaved={false}
        onSave={onSave}
        onEdit={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("Salvar Rascunho"));
    expect(onSave).toHaveBeenCalledOnce();
  });

  it("shows saved state after saving", () => {
    render(
      <StepDocumentResult
        isGenerating={false}
        generatedDocument={mockDocument}
        error={null}
        isSaving={false}
        isSaved={true}
        onSave={vi.fn()}
        onEdit={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("Rascunho Salvo")).toBeInTheDocument();
  });

  it("disables Editar button when not saved", () => {
    render(
      <StepDocumentResult
        isGenerating={false}
        generatedDocument={mockDocument}
        error={null}
        isSaving={false}
        isSaved={false}
        onSave={vi.fn()}
        onEdit={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    const editButton = screen.getByText("Editar").closest("button");
    expect(editButton).toBeDisabled();
  });

  it("enables Editar button when saved", () => {
    const onEdit = vi.fn();
    render(
      <StepDocumentResult
        isGenerating={false}
        generatedDocument={mockDocument}
        error={null}
        isSaving={false}
        isSaved={true}
        onSave={vi.fn()}
        onEdit={onEdit}
        onRetry={vi.fn()}
      />,
    );

    const editButton = screen.getByText("Editar").closest("button")!;
    expect(editButton).not.toBeDisabled();
    fireEvent.click(editButton);
    expect(onEdit).toHaveBeenCalledOnce();
  });
});
