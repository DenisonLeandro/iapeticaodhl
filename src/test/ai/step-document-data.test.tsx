// =============================================================================
// Tests — StepDocumentData (Step 2) + Zod validation
// Story 2.2 — Document Generation Flow
// =============================================================================

import { describe, it, expect } from "vitest";
import { documentGenerationSchema } from "@/lib/validators/document-generation";

describe("documentGenerationSchema (Zod)", () => {
  const validData = {
    documentType: "petition" as const,
    autor: { nome: "João da Silva", cpfCnpj: "123.456.789-00" },
    reu: { nome: "Maria Souza", cpfCnpj: "987.654.321-00" },
    fatos:
      "O autor celebrou contrato de prestação de serviços com a ré e esta descumpriu as obrigações contratuais.",
    fundamentacao: "Art. 389 do Código Civil",
    tribunal: "TJPE" as const,
    vara: "2a Vara Cível do Recife",
    instrucoesAdicionais: "",
  };

  it("accepts valid input", () => {
    const result = documentGenerationSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("requires documentType", () => {
    const result = documentGenerationSchema.safeParse({
      ...validData,
      documentType: undefined,
    });
    expect(result.success).toBe(false);
  });

  it("requires autor.nome with min 2 chars", () => {
    const result = documentGenerationSchema.safeParse({
      ...validData,
      autor: { nome: "A", cpfCnpj: "" },
    });
    expect(result.success).toBe(false);
  });

  it("requires fatos with min 50 chars", () => {
    const result = documentGenerationSchema.safeParse({
      ...validData,
      fatos: "Muito curto",
    });
    expect(result.success).toBe(false);
  });

  it("requires tribunal", () => {
    const result = documentGenerationSchema.safeParse({
      ...validData,
      tribunal: undefined,
    });
    expect(result.success).toBe(false);
  });

  it("validates CPF format", () => {
    const result = documentGenerationSchema.safeParse({
      ...validData,
      autor: { nome: "João", cpfCnpj: "invalid-cpf" },
    });
    expect(result.success).toBe(false);
  });

  it("validates CNPJ format", () => {
    const result = documentGenerationSchema.safeParse({
      ...validData,
      autor: { nome: "Empresa LTDA", cpfCnpj: "12.345.678/0001-00" },
    });
    expect(result.success).toBe(true);
  });

  it("allows empty CPF/CNPJ", () => {
    const result = documentGenerationSchema.safeParse({
      ...validData,
      autor: { nome: "João", cpfCnpj: "" },
    });
    expect(result.success).toBe(true);
  });

  it("allows optional reu", () => {
    const result = documentGenerationSchema.safeParse({
      ...validData,
      reu: undefined,
    });
    expect(result.success).toBe(true);
  });

  it("allows optional fields (vara, fundamentacao, instrucoes)", () => {
    const result = documentGenerationSchema.safeParse({
      ...validData,
      vara: undefined,
      fundamentacao: undefined,
      instrucoesAdicionais: undefined,
    });
    expect(result.success).toBe(true);
  });
});
