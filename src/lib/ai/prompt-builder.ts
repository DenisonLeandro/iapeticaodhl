// =============================================================================
// Prompt Builder — Constructs detailed prompts for legal document generation
// =============================================================================

import type { DocumentType, DocumentGenerationContext } from "@/types/ai";
import { DOCUMENT_TYPE_LABELS } from "@/types/ai";
import type { DocumentGenerationFormData } from "@/lib/validators/document-generation";

/**
 * Build a comprehensive user prompt from form data for AI document generation.
 */
export function buildUserPrompt(
  data: DocumentGenerationFormData,
  jurisprudenciaText?: string,
): string {
  const parts: string[] = [];
  const label = DOCUMENT_TYPE_LABELS[data.documentType] || data.documentType;

  parts.push(`TIPO DE DOCUMENTO: ${label}`);
  parts.push(`TRIBUNAL: ${data.tribunal}`);
  if (data.vara) parts.push(`VARA/CÂMARA: ${data.vara}`);
  if (data.numeroProcesso) parts.push(`NÚMERO DO PROCESSO: ${data.numeroProcesso}`);

  // Autor
  parts.push(`\n--- QUALIFICAÇÃO DO AUTOR ---`);
  parts.push(`Nome: ${data.autor.nome}`);
  if (data.autor.cpfCnpj) parts.push(`CPF/CNPJ: ${data.autor.cpfCnpj}`);
  if (data.autor.endereco) parts.push(`Endereço: ${data.autor.endereco}`);
  if (data.autor.profissao) parts.push(`Profissão: ${data.autor.profissao}`);
  if (data.autor.estadoCivil) parts.push(`Estado Civil: ${data.autor.estadoCivil}`);

  // Réu
  if (data.reu?.nome) {
    parts.push(`\n--- QUALIFICAÇÃO DO RÉU ---`);
    parts.push(`Nome: ${data.reu.nome}`);
    if (data.reu.cpfCnpj) parts.push(`CPF/CNPJ: ${data.reu.cpfCnpj}`);
    if (data.reu.endereco) parts.push(`Endereço: ${data.reu.endereco}`);
    if (data.reu.profissao) parts.push(`Profissão: ${data.reu.profissao}`);
    if (data.reu.estadoCivil) parts.push(`Estado Civil: ${data.reu.estadoCivil}`);
  }

  // Fatos
  parts.push(`\n--- DOS FATOS ---`);
  parts.push(data.fatos);

  // Fundamentação
  if (data.fundamentacao) {
    parts.push(`\n--- DO DIREITO / FUNDAMENTAÇÃO JURÍDICA ---`);
    parts.push(data.fundamentacao);
  }

  // Petição Inicial
  if (data.documentType === "petition") {
    if (data.pedidos) {
      parts.push(`\n--- DOS PEDIDOS ---`);
      parts.push(data.pedidos);
    }
    if (data.valorCausa) parts.push(`\nVALOR DA CAUSA: R$ ${data.valorCausa}`);
    if (data.provas) parts.push(`PROVAS: ${data.provas}`);
    if (data.justicaGratuita) parts.push(`REQUERER JUSTIÇA GRATUITA: Sim (Art. 98 CPC)`);
  }

  // Contestação
  if (data.documentType === "contestation") {
    if (data.preliminares) {
      parts.push(`\n--- PRELIMINARES ---`);
      parts.push(data.preliminares);
    }
    if (data.impugnacaoFatos) {
      parts.push(`\n--- IMPUGNAÇÃO DOS FATOS ---`);
      parts.push(data.impugnacaoFatos);
    }
    if (data.direitoReu) {
      parts.push(`\n--- DO DIREITO DO RÉU ---`);
      parts.push(data.direitoReu);
    }
    if (data.pedidosReu) {
      parts.push(`\n--- PEDIDOS DO RÉU ---`);
      parts.push(data.pedidosReu);
    }
  }

  // Recursos
  if (["appeal", "injunction_appeal", "internal_appeal", "special_appeal", "extraordinary_appeal"].includes(data.documentType)) {
    if (data.decisaoRecorrida) {
      parts.push(`\n--- DECISÃO RECORRIDA ---`);
      parts.push(data.decisaoRecorrida);
    }
    if (data.dataDecisao) parts.push(`DATA DA DECISÃO: ${data.dataDecisao}`);
    if (data.razoesRecurso) {
      parts.push(`\n--- RAZÕES DO RECURSO ---`);
      parts.push(data.razoesRecurso);
    }
    if (data.pedidoReforma) {
      parts.push(`\n--- PEDIDO DE REFORMA ---`);
      parts.push(data.pedidoReforma);
    }
  }

  // Embargos
  if (data.documentType === "declaration_objection") {
    const vicios: string[] = [];
    if (data.vicioObscuridade) vicios.push("Obscuridade");
    if (data.vicioContradicao) vicios.push("Contradição");
    if (data.vicioOmissao) vicios.push("Omissão");
    if (vicios.length > 0) parts.push(`\nVÍCIOS APONTADOS: ${vicios.join(", ")}`);
    if (data.ondeVicio) {
      parts.push(`\n--- LOCALIZAÇÃO DO VÍCIO ---`);
      parts.push(data.ondeVicio);
    }
    if (data.esclarecimentoPretendido) {
      parts.push(`\n--- ESCLARECIMENTO PRETENDIDO ---`);
      parts.push(data.esclarecimentoPretendido);
    }
  }

  // Contratos
  if (data.documentType === "contract") {
    if (data.tipoContrato) parts.push(`\nTIPO DE CONTRATO: ${data.tipoContrato}`);
    if (data.objetoContrato) {
      parts.push(`\n--- OBJETO DO CONTRATO ---`);
      parts.push(data.objetoContrato);
    }
    if (data.obrigacoes) {
      parts.push(`\n--- OBRIGAÇÕES DAS PARTES ---`);
      parts.push(data.obrigacoes);
    }
    if (data.valorContrato) parts.push(`VALOR: R$ ${data.valorContrato}`);
    if (data.formaPagamento) parts.push(`FORMA DE PAGAMENTO: ${data.formaPagamento}`);
    if (data.dataInicio) parts.push(`VIGÊNCIA INÍCIO: ${data.dataInicio}`);
    if (data.dataFim) parts.push(`VIGÊNCIA FIM: ${data.dataFim}`);
    if (data.clausulaRescisao) {
      parts.push(`\n--- CLÁUSULA DE RESCISÃO ---`);
      parts.push(data.clausulaRescisao);
    }
    if (data.foroEleicao) parts.push(`FORO DE ELEIÇÃO: ${data.foroEleicao}`);
  }

  // Notificação
  if (data.documentType === "notification") {
    if (data.destinatarioNotificacao) parts.push(`\nDESTINATÁRIO: ${data.destinatarioNotificacao}`);
    if (data.prazoResposta) parts.push(`PRAZO PARA RESPOSTA: ${data.prazoResposta}`);
  }

  // Jurisprudência
  if (jurisprudenciaText) {
    parts.push(`\n--- JURISPRUDÊNCIA SELECIONADA (usar para embasar o documento) ---`);
    parts.push(jurisprudenciaText);
  }

  // Instruções adicionais
  if (data.instrucoesAdicionais) {
    parts.push(`\n--- INSTRUÇÕES ADICIONAIS ---`);
    parts.push(data.instrucoesAdicionais);
  }

  return parts.join("\n");
}

/**
 * Build the system prompt for legal document generation.
 */
export function buildSystemPrompt(documentType: DocumentType): string {
  const label = DOCUMENT_TYPE_LABELS[documentType] || documentType;

  return `Você é um advogado brasileiro experiente, especializado na elaboração de peças jurídicas processuais e documentos legais.

REGRAS OBRIGATÓRIAS:
1. Escreva em português jurídico formal (pt-BR), com linguagem técnica adequada ao foro.
2. O documento DEVE seguir rigorosamente a estrutura de um(a) ${label}.
3. Cite artigos de lei aplicáveis (CPC/2015, CC/2002, CF/88, CDC, CLT conforme o caso).
4. Inclua jurisprudência quando relevante (cite tribunal, número do acórdão e ementa).
5. Formate com parágrafos numerados, citações em bloco e seções claras.
6. Para peças judiciais, inicie com o endereçamento: "EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA [VARA] DA COMARCA DE [CIDADE]/[UF]"
7. Finalize com: local, data atual, espaço para assinatura do advogado (Nome + OAB).
8. Use formatação HTML para estruturar o documento (h1, h2, h3, p, blockquote, ol, ul, strong, em).
9. Blockquotes devem ser usados para citações de lei e jurisprudência.
10. NÃO invente fatos. Use apenas os dados fornecidos pelo usuário.`;
}

/**
 * Build context object from form data for the generation hook.
 */
export function buildContext(
  data: DocumentGenerationFormData,
  jurisprudenciaText?: string,
): DocumentGenerationContext {
  return {
    client: data.autor.nome,
    facts: data.fatos,
    legal_basis: [data.fundamentacao || "", jurisprudenciaText || ""]
      .filter(Boolean)
      .join("\n\n"),
    court: data.tribunal,
    additional_instructions: data.instrucoesAdicionais || "",
    full_prompt: buildUserPrompt(data, jurisprudenciaText),
  };
}
