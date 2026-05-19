// =============================================================================
// Zod Validation — Document Generation Form
// Story 2.2 — Document Generation Flow (expanded)
// =============================================================================

import { z } from "zod";

/** Validacao basica de CPF (formato: 000.000.000-00 ou 00000000000) */
const cpfPattern = /^(\d{3}\.?\d{3}\.?\d{3}-?\d{2})$/;

/** Validacao basica de CNPJ (formato: 00.000.000/0000-00 ou 00000000000000) */
const cnpjPattern = /^(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})$/;

const cpfCnpjSchema = z
  .string()
  .optional()
  .refine(
    (val) => {
      if (!val || val.trim() === "") return true;
      return cpfPattern.test(val) || cnpjPattern.test(val);
    },
    { message: "CPF ou CNPJ em formato inválido" },
  );

const parteSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  cpfCnpj: cpfCnpjSchema,
  endereco: z.string().optional(),
  profissao: z.string().optional(),
  estadoCivil: z.string().optional(),
});

const parteOpcionalSchema = z.object({
  nome: z.string().optional(),
  cpfCnpj: cpfCnpjSchema,
  endereco: z.string().optional(),
  profissao: z.string().optional(),
  estadoCivil: z.string().optional(),
});

const ALL_TRIBUNAIS = [
  "STF", "STJ", "TST", "TSE", "STM",
  "TJPE", "TJSP", "TJRJ", "TJMG",
  "TRF-1", "TRF-2", "TRF-3", "TRF-4", "TRF-5",
  "Outro",
] as const;

const ALL_DOCUMENT_TYPES = [
  "petition", "contestation", "reply", "counterclaim",
  "appeal", "injunction_appeal", "internal_appeal", "declaration_objection",
  "special_appeal", "extraordinary_appeal",
  "contract", "notification", "requirement",
  "opinion", "power_of_attorney",
  "final_arguments", "simple_petition", "other",
] as const;

export const documentGenerationSchema = z.object({
  documentType: z.enum(ALL_DOCUMENT_TYPES, {
    required_error: "Selecione o tipo de documento",
  }),

  autor: parteSchema,
  reu: parteOpcionalSchema.optional(),

  fatos: z
    .string()
    .min(50, "Descreva os fatos com pelo menos 50 caracteres"),

  fundamentacao: z.string().optional(),

  tribunal: z.enum(ALL_TRIBUNAIS, {
    required_error: "Selecione o tribunal",
  }),

  vara: z.string().optional(),
  numeroProcesso: z.string().optional(),
  clienteVinculadoId: z.string().optional(),

  instrucoesAdicionais: z.string().optional(),

  // Petição Inicial
  pedidos: z.string().optional(),
  valorCausa: z.string().optional(),
  provas: z.string().optional(),
  justicaGratuita: z.boolean().optional(),

  // Contestação
  preliminares: z.string().optional(),
  impugnacaoFatos: z.string().optional(),
  direitoReu: z.string().optional(),
  pedidosReu: z.string().optional(),

  // Recursos
  decisaoRecorrida: z.string().optional(),
  dataDecisao: z.string().optional(),
  razoesRecurso: z.string().optional(),
  pedidoReforma: z.string().optional(),
  comprovarPreparo: z.boolean().optional(),

  // Embargos de Declaração
  vicioObscuridade: z.boolean().optional(),
  vicioContradicao: z.boolean().optional(),
  vicioOmissao: z.boolean().optional(),
  ondeVicio: z.string().optional(),
  esclarecimentoPretendido: z.string().optional(),

  // Contratos
  tipoContrato: z.string().optional(),
  objetoContrato: z.string().optional(),
  obrigacoes: z.string().optional(),
  valorContrato: z.string().optional(),
  formaPagamento: z.string().optional(),
  prazoContrato: z.string().optional(),
  dataInicio: z.string().optional(),
  dataFim: z.string().optional(),
  clausulaRescisao: z.string().optional(),
  foroEleicao: z.string().optional(),

  // Notificação
  destinatarioNotificacao: z.string().optional(),
  prazoResposta: z.string().optional(),
});

export type DocumentGenerationFormData = z.infer<
  typeof documentGenerationSchema
>;
