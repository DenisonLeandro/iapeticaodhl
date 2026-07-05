// =============================================================================
// PR-4.4B.2 — Blocos obrigatórios por (área, tipo de peça) + textos fixos.
// Consumido por generate-legal-draft e review-legal-draft.
// =============================================================================

export interface RequiredBlock {
  id: string;
  label: string;
  guidance: string;
  optional?: boolean;
}

export interface RequiredBlocksSet {
  base: RequiredBlock[];
  motorista_profissional: RequiredBlock[];
}

const TRABALHISTA_INICIAL_BASE: RequiredBlock[] = [
  { id: "gratuidade", label: "Justiça gratuita", guidance: "Fundamentar art. 5º LXXIV CF; art. 98 CPC; art. 790 §§3º e 4º CLT." },
  { id: "sintese_contrato", label: "Síntese do contrato", guidance: "Função, admissão, remuneração, jornada, término (se houver)." },
  { id: "merito_topicos", label: "Mérito por tópicos", guidance: "Cada tese em tópico próprio: fatos → fundamento → aplicação → pedido." },
  { id: "onus_prova", label: "Ônus da prova", guidance: "art. 818 CLT + art. 373 CPC + aptidão; quando aplicável, inversão." },
  { id: "exibicao_documentos", label: "Exibição de documentos", guidance: "art. 400 CPC; especificar documentos e consequências da não exibição." },
  { id: "nao_limitacao", label: "Não limitação da condenação aos valores da inicial", guidance: "Tópico próprio obrigatório + item no pedido final. Ver texto fixo." },
  { id: "juros_correcao", label: "Juros e correção monetária", guidance: "Aplicar entendimento atual (Lei 13.467/17 e decisões vinculantes STF/TST)." },
  { id: "honorarios", label: "Honorários advocatícios", guidance: "art. 791-A CLT; cuidado com beneficiário da justiça gratuita — marcar revisão ADI 5.766/STF." },
  { id: "protesto_provas", label: "Protesto por provas", guidance: "Depoimentos, testemunhas, perícia, documentos, inspeção." },
  { id: "pedido_final", label: "Pedido final numerado e detalhado", guidance: "Cada pedido remete ao tópico; reflexos discriminados; sucessivos quando cabíveis; valores ou [CALCULAR VALOR]." },
  { id: "valor_causa", label: "Valor da causa", guidance: "Soma dos pedidos ou marcador se depender de cálculo." },
  { id: "pontos_confirmar", label: "Pontos a confirmar antes do protocolo", guidance: "Seção final com lacunas acionáveis para o advogado." },
];

const TRABALHISTA_MOTORISTA: RequiredBlock[] = [
  { id: "lei_13103", label: "Lei 13.103/2015 (motorista profissional)", guidance: "Avaliar aplicabilidade; controle de jornada obrigatório." },
  { id: "controle_jornada", label: "Controle de jornada", guidance: "Diário de bordo, papeleta, ficha externa, tacógrafo, MDF-e, CT-e, rastreador/GPS." },
  { id: "art_62_i", label: "Art. 62, I, CLT", guidance: "Afastar quando houver meios de controle (Lei 13.103); inverter ônus da prova." },
  { id: "tempo_espera", label: "Tempo de espera", guidance: "Distinguir de hora extra; art. 235-C §8º CLT." },
  { id: "intra", label: "Intervalo intrajornada", guidance: "art. 71 CLT; após Reforma (13/11/2017) aplicar §4º — indenização só do tempo suprimido." },
  { id: "inter", label: "Intervalo interjornada", guidance: "art. 66 CLT; horas suprimidas como extras + reflexos." },
  { id: "dsr_feriados", label: "Domingos e feriados", guidance: "Lei 605/49; Súmula 146/TST; dobra sem compensação." },
  { id: "adicional_noturno", label: "Adicional noturno", guidance: "art. 73 CLT; hora reduzida; prorrogação; reflexos." },
  { id: "diarias", label: "Diárias / reembolso", guidance: "Distinguir indenizatório vs. salarial (art. 457 §2º CLT)." },
  { id: "produtividade", label: "Produtividade / comissões / pagamentos variáveis", guidance: "Habitualidade; integração; separar do holerite de pagamento por fora." },
  { id: "fgts", label: "FGTS", guidance: "Lei 8.036/90; Súmula 461/TST; multa 40%." },
  { id: "rescisorias", label: "Verbas rescisórias", guidance: "arts. 477 e 467 CLT; aviso, 13º, férias+1/3, saldo, FGTS+40%, guias, baixa CTPS, seguro-desemprego." },
];

export const REQUIRED_BLOCKS: Record<string, Record<string, RequiredBlocksSet>> = {
  trabalhista: {
    initial_petition: {
      base: TRABALHISTA_INICIAL_BASE,
      motorista_profissional: TRABALHISTA_MOTORISTA,
    },
  },
};

// -------------------------------------------------------------------------
// Textos fixos obrigatórios
// -------------------------------------------------------------------------

export const NON_LIMITATION_TOPIC = `DA ESTIMATIVA DOS VALORES ATRIBUÍDOS AOS PEDIDOS E DA NÃO LIMITAÇÃO DA CONDENAÇÃO

Os valores atribuídos aos pedidos formulados na presente inicial são apresentados por estimativa, em atendimento ao art. 840, §1º, da CLT, não representando renúncia a eventuais diferenças apuradas em regular liquidação de sentença, especialmente porque diversos documentos necessários à exata apuração dos créditos estão em poder da Reclamada.

Assim, requer-se que os valores indicados sejam considerados meramente estimativos, não havendo limitação da condenação aos montantes atribuídos na inicial, devendo prevalecer o valor integral que vier a ser apurado em liquidação de sentença, observados os documentos juntados aos autos, os documentos cuja exibição se requer e a prova produzida.

[REVISAR JURISPRUDÊNCIA ATUAL SOBRE LIMITAÇÃO AOS VALORES DA INICIAL]`;

export const NON_LIMITATION_REQUEST =
  "Requer seja reconhecido que os valores atribuídos aos pedidos são meramente estimativos, não limitando a condenação, devendo as parcelas deferidas ser apuradas integralmente em liquidação de sentença.";

export const NON_LIMITATION_WARNING =
  "[REVISAR JURISPRUDÊNCIA ATUAL SOBRE LIMITAÇÃO AOS VALORES DA INICIAL]";

// -------------------------------------------------------------------------
// Detecção de perfil motorista profissional
// -------------------------------------------------------------------------

const MOTORISTA_KEYWORDS =
  /\b(motorista|carreteiro|caminhoneiro|mdf-?e|ct-?e|rastreador|tacógrafo|papeleta|diário de bordo|transportadora)\b/i;

export function detectMotoristaProfile(ctx: {
  intake?: Record<string, unknown> | null;
  analysis?: Record<string, unknown> | null;
  case?: Record<string, unknown> | null;
}): boolean {
  const hay = [
    String(ctx.intake?.problem_summary ?? ""),
    String(ctx.intake?.client_story ?? ""),
    String((ctx.intake as { profession?: string } | null | undefined)?.profession ?? ""),
    String((ctx.analysis as { content_json?: { summary?: string } } | null | undefined)?.content_json?.summary ?? ""),
    String(ctx.case?.subject ?? ""),
  ].join("  ");
  return MOTORISTA_KEYWORDS.test(hay);
}

export function getRequiredBlocks(
  legalArea: string | null | undefined,
  pieceType: string,
  isMotorista: boolean,
): RequiredBlock[] {
  const area = (legalArea ?? "").toLowerCase();
  const set = REQUIRED_BLOCKS[area]?.[pieceType];
  if (!set) return [];
  return isMotorista ? [...set.base, ...set.motorista_profissional] : set.base;
}

export function renderRequiredBlocksForPrompt(blocks: RequiredBlock[]): string {
  if (blocks.length === 0) return "";
  const lines = blocks.map(
    (b) => `- **${b.label}** — ${b.guidance}`,
  );
  return `# BLOCOS OBRIGATÓRIOS DO ESCRITÓRIO (avalie cada um; INCLUIR se houver base; MARCAR como pendente se faltar dado; EXCLUIR com justificativa se não houver base)
${lines.join("\n")}

REGRA CRÍTICA: cada bloco acima DEVE ser avaliado. Não pode ser silenciosamente omitido.`;
}
