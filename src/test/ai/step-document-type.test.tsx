// =============================================================================
// Tests — StepDocumentType (Step 1)
// Story 2.2 — Document Generation Flow
// =============================================================================

import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { screen, fireEvent } from "@testing-library/dom";
import StepDocumentType from "@/components/ai/steps/StepDocumentType";

describe("StepDocumentType", () => {
  it("renders all 7 document type cards", () => {
    render(<StepDocumentType selectedType={null} onSelect={vi.fn()} />);

    expect(screen.getByText("Petição Inicial")).toBeInTheDocument();
    expect(screen.getByText("Recurso / Apelação")).toBeInTheDocument();
    expect(screen.getByText("Contrato")).toBeInTheDocument();
    expect(screen.getByText("Notificação Extrajudicial")).toBeInTheDocument();
    expect(screen.getByText("Parecer Jurídico")).toBeInTheDocument();
    expect(screen.getByText("Procuração")).toBeInTheDocument();
    expect(screen.getByText("Outro")).toBeInTheDocument();
  });

  it("calls onSelect when a card is clicked", () => {
    const onSelect = vi.fn();
    render(<StepDocumentType selectedType={null} onSelect={onSelect} />);

    fireEvent.click(screen.getByText("Contrato"));
    expect(onSelect).toHaveBeenCalledWith("contract");
  });

  it("highlights the selected card", () => {
    render(
      <StepDocumentType selectedType="petition" onSelect={vi.fn()} />,
    );

    const card = screen.getByText("Petição Inicial").closest("[role='button']");
    expect(card).toHaveAttribute("aria-pressed", "true");
  });

  it("supports keyboard navigation (Enter)", () => {
    const onSelect = vi.fn();
    render(<StepDocumentType selectedType={null} onSelect={onSelect} />);

    const card = screen.getByText("Parecer Jurídico").closest("[role='button']")!;
    fireEvent.keyDown(card, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("opinion");
  });

  it("supports keyboard navigation (Space)", () => {
    const onSelect = vi.fn();
    render(<StepDocumentType selectedType={null} onSelect={onSelect} />);

    const card = screen.getByText("Procuração").closest("[role='button']")!;
    fireEvent.keyDown(card, { key: " " });
    expect(onSelect).toHaveBeenCalledWith("power_of_attorney");
  });
});
