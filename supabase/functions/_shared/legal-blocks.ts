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
  { id: "intra", label: "Intervalo intrajornada", guidance: "art. 71 CLT. SEGMENTAR por período contratual: antes de 11/11/2017 aplicar Súmula 437/TST (pagamento integral, natureza salarial, com reflexos); a partir de 11/11/2017 aplicar §4º (apenas o tempo SUPRIMIDO, natureza indenizatória). NÃO afirmar pagamento integral de forma absoluta em contratos pós-Reforma. Marcar [REVISAR APLICAÇÃO TEMPORAL — art. 71, §4º, CLT pós-Reforma]." },
  { id: "inter", label: "Intervalo interjornada", guidance: "art. 66 CLT; horas suprimidas como extras + reflexos." },
  { id: "dsr_feriados", label: "Domingos e feriados", guidance: "Lei 605/49; Súmula 146/TST; dobra sem compensação." },
  { id: "adicional_noturno", label: "Adicional noturno", guidance: "art. 73 CLT; hora reduzida; prorrogação; reflexos." },
  { id: "diarias", label: "Diárias / reembolso", guidance: "Distinguir indenizatório vs. salarial (art. 457 §2º CLT)." },
  { id: "produtividade", label: "Produtividade / comissões / pagamentos variáveis", guidance: "Habitualidade; integração; separar do holerite de pagamento por fora." },
  { id: "fgts", label: "FGTS", guidance: "Lei 8.036/90; Súmula 461/TST; multa 40%." },
  { id: "rescisorias", label: "Verbas rescisórias", guidance: "arts. 477 e 467 CLT; aviso, 13º, férias+1/3, saldo, FGTS+40%, guias, baixa CTPS, seguro-desemprego." },
  { id: "exibicao_motorista", label: "Exibição ampliada de documentos (motorista)", guidance: "art. 400 CPC + Súmula 338, I, TST. Requerer lista canônica MOTORISTA_EXHIBITION_LIST: controles de jornada, diário de bordo, papeletas, ficha de trabalho externo, relatórios de rastreador/GPS, discos e relatórios de tacógrafo, MDF-e, CT-e, relatórios de viagem, relatórios de km rodado, relatórios de produtividade, comprovantes de pagamento de produtividade/bônus, holerites, recibos de férias, extratos analíticos de FGTS, comprovantes de depósito do FGTS, fichas de EPI, PPRA/PGR, PCMSO, LTCAT, laudos ambientais, documentos referentes a produtos químicos transportados (FISPQ, romaneios, MOPP, ANTT)." },
  { id: "insalubridade_motorista", label: "Insalubridade (motorista com produtos químicos/ruído/vibração)", guidance: "Fundamentar em arts. 189, 190, 191, 192 CLT + NR-15 (agentes químicos, ruído, vibração, calor) + perícia (art. 195 CLT). NÃO invocar Súmula 448/TST por analogia — usar CLT/NR-15 diretamente. Base de cálculo: [REVISAR ENTENDIMENTO ATUAL — SV 4/STF]." },
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

export const NON_LIMITATION_TOPIC_HEADER =
  "DA ESTIMATIVA DOS VALORES ATRIBUÍDOS AOS PEDIDOS E DA NÃO LIMITAÇÃO DA CONDENAÇÃO";

// Lista canônica de documentos para exibição obrigatória em causas de motorista profissional.
export const MOTORISTA_EXHIBITION_LIST = [
  "controles de jornada",
  "diário de bordo",
  "papeletas",
  "ficha de trabalho externo",
  "relatórios de rastreador/GPS",
  "discos e relatórios de tacógrafo",
  "MDF-e",
  "CT-e",
  "relatórios de viagem",
  "relatórios de km rodado",
  "relatórios de produtividade",
  "comprovantes de pagamento de produtividade e/ou bônus",
  "holerites",
  "recibos de férias",
  "extratos analíticos de FGTS",
  "comprovantes de depósito do FGTS",
  "fichas de EPI",
  "PPRA/PGR",
  "PCMSO",
  "LTCAT",
  "laudos ambientais",
  "documentos referentes a produtos químicos transportados (FISPQ, romaneios, MOPP, ANTT)",
];

export const NON_LIMITATION_TOPIC = `${NON_LIMITATION_TOPIC_HEADER}

Os valores atribuídos aos pedidos formulados na presente inicial são apresentados por MERA ESTIMATIVA, em atendimento ao disposto no art. 840, §1º, da CLT, não representando renúncia a eventuais diferenças que vierem a ser apuradas em regular liquidação de sentença.

Isso porque diversos documentos indispensáveis à exata apuração dos créditos trabalhistas estão em poder exclusivo da Reclamada — em especial, tratando-se de motorista profissional, ${MOTORISTA_EXHIBITION_LIST.join(", ")}.

Diante disso, requer-se que os valores indicados sejam considerados MERAMENTE ESTIMATIVOS, sem qualquer limitação da condenação aos montantes atribuídos na inicial, devendo prevalecer o valor INTEGRAL que vier a ser apurado em liquidação de sentença, observados os documentos juntados aos autos, os documentos cuja exibição se requer e a prova produzida.

[REVISAR JURISPRUDÊNCIA ATUAL DO RESPECTIVO TRT E DO TST SOBRE LIMITAÇÃO/ESTIMATIVA DO ART. 840, §1º, CLT APÓS A REFORMA TRABALHISTA]`;

export const NON_LIMITATION_REQUEST =
  "seja expressamente reconhecido que os valores atribuídos aos pedidos são MERAMENTE ESTIMATIVOS, na forma do art. 840, §1º, da CLT, NÃO LIMITANDO A CONDENAÇÃO aos montantes indicados na inicial, devendo as parcelas deferidas ser apuradas INTEGRALMENTE em liquidação de sentença, observados os documentos juntados, os documentos cuja exibição se requer e a prova produzida";

export const NON_LIMITATION_WARNING =
  "[REVISAR JURISPRUDÊNCIA ATUAL SOBRE LIMITAÇÃO AOS VALORES DA INICIAL]";

// Pedido sucessivo obrigatório em inicial que sustente rescisão indireta.
export const SUCCESSIVE_RESCISAO_INDIRETA_TOPIC = `DO PEDIDO SUCESSIVO — HIPÓTESE DE NÃO RECONHECIMENTO DA RESCISÃO INDIRETA

Na remota hipótese de este r. Juízo entender pela não caracterização da rescisão indireta do contrato de trabalho (art. 483 da CLT), requer-se, SUCESSIVAMENTE, que seja reconhecido o direito do Reclamante ao pagamento de todas as parcelas contratuais, verbas e diferenças reconhecidas ao longo do pacto laboral — em especial aviso-prévio proporcional indenizado (Lei 12.506/2011), 13º salário proporcional, férias proporcionais + 1/3, saldo de salário, FGTS do período + multa de 40%, liberação/indenização substitutiva das guias de FGTS e do seguro-desemprego, baixa e anotações regulares na CTPS — ainda que rejeitada a conversão pretendida, mantendo-se hígidos os demais pedidos formulados nesta inicial que não dependam, exclusivamente, do reconhecimento da rescisão indireta.

O pedido sucessivo é formulado por cautela, em atenção ao princípio da eventualidade e à ampla defesa dos interesses do Reclamante, sem prejuízo da procedência do pedido principal de conversão do vínculo em rescisão indireta.`;

export const SUCCESSIVE_RESCISAO_INDIRETA_REQUEST =
  "SUCESSIVAMENTE, na hipótese de não reconhecimento da rescisão indireta, seja a Reclamada condenada ao pagamento das parcelas contratuais e verbas rescisórias como se tratasse de dispensa sem justa causa — aviso-prévio proporcional indenizado (Lei 12.506/2011), 13º proporcional, férias proporcionais + 1/3, saldo de salário, FGTS do período + multa de 40%, liberação das guias de FGTS e do seguro-desemprego, baixa e anotações na CTPS — utilizando-se [CALCULAR VALOR — revisar memória de cálculo] para os valores não injetáveis, mantidos os demais pedidos que não dependam exclusivamente da conversão pretendida";

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
