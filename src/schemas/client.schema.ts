import { z } from "zod";

// =============================================================================
// CPF Validation
// =============================================================================
export function isValidCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, "");
  if (cleaned.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleaned)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cleaned[i]) * (10 - i);
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(cleaned[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cleaned[i]) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  return remainder === parseInt(cleaned[10]);
}

// =============================================================================
// CNPJ Validation
// =============================================================================
export function isValidCNPJ(cnpj: string): boolean {
  const cleaned = cnpj.replace(/\D/g, "");
  if (cleaned.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cleaned)) return false;

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(cleaned[i]) * weights1[i];
  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;
  if (parseInt(cleaned[12]) !== digit1) return false;

  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(cleaned[i]) * weights2[i];
  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;
  return parseInt(cleaned[13]) === digit2;
}

// =============================================================================
// Mask utilities
// =============================================================================
export function maskCPF(value: string): string {
  const cleaned = value.replace(/\D/g, "").slice(0, 11);
  return cleaned
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function maskCNPJ(value: string): string {
  const cleaned = value.replace(/\D/g, "").slice(0, 14);
  return cleaned
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

export function maskPhone(value: string): string {
  const cleaned = value.replace(/\D/g, "").slice(0, 11);
  if (cleaned.length <= 10) {
    return cleaned
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  }
  return cleaned
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}

export function maskCEP(value: string): string {
  const cleaned = value.replace(/\D/g, "").slice(0, 8);
  return cleaned.replace(/(\d{5})(\d{1,3})$/, "$1-$2");
}

// =============================================================================
// Address Schema
// =============================================================================
const addressSchema = z.object({
  street: z.string().min(1, "Rua é obrigatória"),
  number: z.string().min(1, "Número é obrigatório"),
  complement: z.string().optional().default(""),
  neighborhood: z.string().min(1, "Bairro é obrigatório"),
  city: z.string().min(1, "Cidade é obrigatória"),
  state: z.string().length(2, "UF é obrigatória"),
  zip_code: z.string().min(1, "CEP é obrigatório"),
});

// =============================================================================
// Client Form Schema
// =============================================================================
export const clientFormSchema = z
  .object({
    full_name: z
      .string()
      .min(1, "Nome completo é obrigatório")
      .min(3, "Nome deve ter pelo menos 3 caracteres"),
    document_type: z.enum(["cpf", "cnpj"], {
      required_error: "Tipo de documento é obrigatório",
    }),
    document_number: z.string().min(1, "Número do documento é obrigatório"),
    email: z.string().email("Formato de email inválido"),
    phone: z.string().min(1, "Telefone é obrigatório"),
    address: addressSchema,
    notes: z.string().optional().default(""),
  })
  .refine(
    (data) => {
      const cleaned = data.document_number.replace(/\D/g, "");
      if (data.document_type === "cpf") return isValidCPF(cleaned);
      if (data.document_type === "cnpj") return isValidCNPJ(cleaned);
      return true;
    },
    {
      message: "Número de documento inválido",
      path: ["document_number"],
    },
  );

export type ClientFormValues = z.infer<typeof clientFormSchema>;

// =============================================================================
// Interaction Form Schema
// =============================================================================
export const interactionFormSchema = z.object({
  interaction_date: z.string().min(1, "Data do atendimento é obrigatória"),
  subject: z.string().min(3, "Assunto deve ter pelo menos 3 caracteres"),
  notes: z.string().optional().default(""),
});

export type InteractionFormValues = z.infer<typeof interactionFormSchema>;

// =============================================================================
// File Upload Validation
// =============================================================================
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const fileUploadSchema = z.object({
  file: z
    .instanceof(File)
    .refine((file) => file.size <= MAX_FILE_SIZE, {
      message: "Arquivo deve ter no máximo 10MB",
    })
    .refine(
      (file) => (ALLOWED_MIME_TYPES as readonly string[]).includes(file.type),
      {
        message: "Tipo de arquivo não permitido. Use JPEG, PNG, WebP ou PDF",
      },
    ),
  description: z.string().optional().default(""),
});

export type FileUploadValues = z.infer<typeof fileUploadSchema>;

export { ALLOWED_MIME_TYPES, MAX_FILE_SIZE };
