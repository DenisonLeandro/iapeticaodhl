// =============================================================================
// PR-EXCELÊNCIA 1 — Teses jurídicas recorrentes (curadas, sem IA, sem banco).
//
// Objetivo: a petição não deve pedir ao advogado que pesquise matéria que o
// sistema já conhece. Cada tese traz APENAS orientação de aplicação e a base
// legal/vinculante correspondente — nunca texto pronto para colar, nunca
// número de processo, relator, órgão julgador ou data de acórdão comum.
//
// Consumido por Edge Functions (Deno) e pelo frontend via alias "@shared".
// Não pode importar nada de Deno nem do browser.
// =============================================================================

export interface LegalThesis {
  key: string;
  title: string;
  guidance: string;
  legal_basis: string[];
  reviewed_at: string;
}

export const LEGAL_THESES: LegalThesis[] = [
  {
    key: "justica_gratuita",
    title: "Justiça gratuita",
    guidance:
      "Sustentar o direito à gratuidade com base na declaração de hipossuficiência do próprio reclamante, que goza de presunção relativa de veracidade. Amarrar à situação concreta (desemprego, último salário, encargos familiares) já narrada nos fatos. Não condicionar o pedido a comprovação de renda inferior a 40% do teto do RGPS quando houver declaração, e não pedir revisão jurisprudencial: a matéria está assentada.",
    legal_basis: [
      "art. 5º, LXXIV, da Constituição Federal",
      "art. 98 do CPC",
      "art. 790, §§ 3º e 4º, da CLT",
      "Súmula 463, I, do TST",
    ],
    reviewed_at: "2026-08-06",
  },
  {
    key: "honorarios_beneficiario_gratuidade",
    title: "Honorários sucumbenciais do beneficiário da justiça gratuita",
    guidance:
      "Sustentar de forma afirmativa que os créditos trabalhistas obtidos no processo NÃO podem ser utilizados para pagar honorários de sucumbência ou periciais do beneficiário da gratuidade, por inconstitucionalidade já declarada da expressão que autorizava esse desconto. Requerer expressamente que eventual condenação em honorários fique sob condição suspensiva de exigibilidade. Vincular ao pedido de gratuidade formulado na mesma peça. É PROIBIDO inserir marcador de revisão sobre esta matéria.",
    legal_basis: [
      "art. 791-A, § 4º, da CLT",
      "art. 790-B, § 4º, da CLT",
      "ADI 5.766/STF (julgada; inconstitucionalidade da compensação automática com créditos obtidos no processo)",
      "art. 5º, LXXIV, e art. 7º, X, da Constituição Federal",
    ],
    reviewed_at: "2026-08-06",
  },
  {
    key: "adi_5766",
    title: "ADI 5.766/STF — alcance da decisão",
    guidance:
      "Tratar a ADI 5.766 como julgada e de eficácia vinculante: a cobrança de honorários periciais e sucumbenciais do beneficiário da gratuidade com os créditos obtidos no próprio processo foi afastada. Redigir de forma assertiva, aplicando a conclusão ao caso concreto. NÃO escrever [REVISAR ADI 5.766/STF], [ATUALIZAR ENTENDIMENTO] ou equivalente. Se houver necessidade de citar a decisão, citar apenas como 'ADI 5.766/STF' — sem relator, data ou número de acórdão.",
    legal_basis: [
      "ADI 5.766/STF",
      "art. 791-A, § 4º, da CLT",
      "art. 790-B, § 4º, da CLT",
    ],
    reviewed_at: "2026-08-06",
  },
  {
    key: "correcao_juros_adc_58",
    title: "Correção monetária e juros de mora",
    guidance:
      "Requerer a atualização dos créditos conforme o critério fixado em decisão vinculante do STF: na fase pré-judicial, IPCA-E acrescido dos juros legais do art. 39 da Lei 8.177/91; a partir do ajuizamento, taxa SELIC, que já engloba correção e juros. Redigir de forma afirmativa e aplicada ao pedido, sem marcador de revisão.",
    legal_basis: [
      "ADC 58/STF e ADC 59/STF",
      "art. 39 da Lei 8.177/1991",
      "art. 883 da CLT",
      "art. 406 do Código Civil",
    ],
    reviewed_at: "2026-08-06",
  },
  {
    key: "trabalho_externo_controle_jornada",
    title: "Trabalho externo e possibilidade de controle de jornada",
    guidance:
      "Afastar a exceção do art. 62, I, da CLT demonstrando, com os fatos concretos do caso, que havia meios de controle da jornada — rastreador ou GPS no veículo, roteiro de visitas pré-determinado, sistema informatizado de pedidos, reporte diário a superior, metas com horário, aplicativo de mensagens. Sustentar que a exceção só se aplica quando o controle é efetivamente impossível, e que a mera anotação da condição na CTPS não basta. Descrever os meios de controle específicos deste caso, sem listar hipóteses genéricas que não ocorreram.",
    legal_basis: [
      "art. 62, I, da CLT",
      "art. 74, § 2º, da CLT",
      "art. 6º, parágrafo único, da CLT (meios telemáticos de comando e supervisão)",
      "art. 9º da CLT",
    ],
    reviewed_at: "2026-08-06",
  },
  {
    key: "sumula_338_tst",
    title: "Não apresentação dos controles de jornada (Súmula 338 do TST)",
    guidance:
      "Requerer a exibição dos controles de ponto e demais registros de jornada, sustentando que a não apresentação injustificada, pelo empregador com mais de vinte empregados, gera presunção relativa de veracidade da jornada declinada na inicial. Aplicar também aos registros britânicos e aos controles inválidos. Amarrar à jornada concretamente narrada e aos documentos que estão em poder exclusivo da reclamada neste caso.",
    legal_basis: [
      "Súmula 338, I, II e III, do TST",
      "art. 74, § 2º, da CLT",
      "art. 400 do CPC",
      "art. 818, § 1º, da CLT",
    ],
    reviewed_at: "2026-08-06",
  },
  {
    key: "intervalo_intrajornada",
    title: "Intervalo intrajornada",
    guidance:
      "SEGMENTAR por período contratual, sem marcador de revisão: para o período anterior a 11/11/2017, a concessão parcial gera pagamento integral do intervalo, com natureza salarial e reflexos; a partir de 11/11/2017, aplica-se o § 4º do art. 71, com pagamento apenas do período suprimido, acrescido de 50%, e natureza indenizatória. Verificar a data de admissão do caso e aplicar somente o regime pertinente — se o contrato é integralmente posterior à Reforma, tratar apenas do § 4º e não afirmar pagamento integral.",
    legal_basis: [
      "art. 71, caput e § 4º, da CLT (redação da Lei 13.467/2017)",
      "Súmula 437 do TST (contratos anteriores a 11/11/2017)",
      "art. 611-A da CLT (limites da negociação coletiva)",
    ],
    reviewed_at: "2026-08-06",
  },
  {
    key: "rescisao_indireta",
    title: "Rescisão indireta do contrato de trabalho",
    guidance:
      "Enquadrar a falta patronal em alínea específica do art. 483 da CLT — não basta afirmar 'descumprimento contratual' de forma genérica. Descrever a conduta concreta (exigência de serviço além das forças, descumprimento de obrigação contratual, rigor excessivo) e demonstrar a gravidade. Quando houver pedido de demissão formalizado antes, sustentar a nulidade do ato e a conversão da modalidade, indicando por que a vontade foi viciada ou por que o vício contratual preexistia. Postular as verbas próprias da dispensa imotivada e a liberação de guias. Não é exigível a imediatidade absoluta quando a falta é continuada.",
    legal_basis: [
      "art. 483, alíneas a a g, e §§ 1º a 3º, da CLT",
      "art. 484-A da CLT (distinção)",
      "art. 9º da CLT",
      "art. 186 do Código Civil",
    ],
    reviewed_at: "2026-08-06",
  },
  {
    key: "integracao_remuneracao_variavel",
    title: "Integração da remuneração variável",
    guidance:
      "Demonstrar a habitualidade e a natureza salarial das parcelas variáveis (comissões, prêmios por venda, bônus de produtividade) com base nas fichas financeiras do caso, e postular a integração à remuneração para todos os efeitos, com reflexos discriminados em DSR, aviso-prévio, férias com 1/3, décimo terceiro e FGTS com a multa. Ao pedir horas extras, observar que a base de cálculo é a remuneração total e que sobre a parte variável incide apenas o adicional. Distinguir do prêmio eventual e do reembolso de despesa, que não integram.",
    legal_basis: [
      "art. 457, §§ 1º e 2º, da CLT",
      "art. 7º da Lei 605/1949",
      "Súmula 264 do TST",
      "Súmula 340 do TST",
      "Súmula 172 do TST",
      "OJ 397 da SDI-1 do TST",
    ],
    reviewed_at: "2026-08-06",
  },
  {
    key: "honorarios_sucumbenciais",
    title: "Honorários advocatícios sucumbenciais",
    guidance:
      "Postular honorários de sucumbência sobre o valor que resultar da liquidação da sentença, na faixa legal de 5% a 15%, justificando o percentual pretendido pelo grau de zelo, pelo lugar da prestação e pela complexidade da causa. Quando o reclamante for beneficiário da gratuidade, articular com a tese própria: eventual sucumbência recíproca fica sob condição suspensiva de exigibilidade e não pode ser satisfeita com os créditos obtidos no processo. Não escrever marcador de revisão.",
    legal_basis: [
      "art. 791-A, caput e §§ 2º, 3º e 4º, da CLT",
      "art. 85, §§ 2º e 8º, do CPC",
      "ADI 5.766/STF",
    ],
    reviewed_at: "2026-08-06",
  },
  {
    key: "horas_extras_8_44",
    title: "Horas extras — excedente da 8ª diária e da 44ª semanal",
    guidance:
      "Desenvolver o capítulo de horas extras com autonomia, sem depender do intervalo intrajornada. Narrar a jornada dia a dia exatamente como apurada nos FATOS APURADOS DE JORNADA (horário de entrada, saída, intervalo concedido e dias da semana), apontar o excedente da 8ª hora diária E o excedente da 44ª hora semanal, e pedir o pagamento das horas extras com adicional mínimo de 50%, base de cálculo pela remuneração global (não apenas o salário-base) e divisor aplicável à jornada contratual. Requerer os reflexos em DSR e, com estes, em aviso prévio, 13º salários, férias acrescidas de 1/3 e FGTS com a multa de 40%. É PROIBIDO afirmar duração de jornada ou excedente diferente do apurado pelo sistema, e é PROIBIDO pedir adicional de feriado, de domingo ou noturno sem fato narrado.",
    legal_basis: [
      "art. 7º, XIII e XVI, da Constituição Federal",
      "arts. 58, 59 e 64 da CLT",
      "Súmula 264 do TST (base de cálculo — remuneração global)",
      "Súmula 172 do TST (reflexos em DSR)",
      "Súmula 347 do TST (média física das horas extras habituais)",
      "Súmula 431 do TST (divisor para jornada de 6 horas)",
      "OJ 394 da SDI-1 do TST (majoração do DSR e reflexos)",
    ],
    reviewed_at: "2026-08-11",
  },
  {
    key: "art71_faixas_intervalo",
    title: "Faixas do intervalo intrajornada (art. 71 da CLT)",
    guidance:
      "Aplicar corretamente as faixas legais: jornada superior a 6 horas exige 1 hora de intervalo; jornada superior a 4 e até 6 horas exige 15 minutos; jornada de até 4 horas não exige intervalo. É PROIBIDO escrever que jornada 'superior a 4 horas' exige 1 hora de intervalo. Só formular pedido de intervalo suprimido quando o intervalo concedido for INFERIOR ao devido pela faixa correta, conforme os FATOS APURADOS DE JORNADA — se o intervalo estiver regular naquele grupo de dias, não formular o pedido nem no mérito nem no rol final.",
    legal_basis: [
      "art. 71, caput, § 1º e § 4º, da CLT",
      "Súmula 437 do TST (contratos anteriores a 11/11/2017)",
      "Lei 13.467/2017",
    ],
    reviewed_at: "2026-08-11",
  },
];

export const LEGAL_THESIS_BY_KEY: Record<string, LegalThesis> = Object.fromEntries(
  LEGAL_THESES.map((t) => [t.key, t]),
);

// ---------------------------------------------------------------------------
// Seleção determinística — sem IA, sem regra por cliente/empresa/processo.
// ---------------------------------------------------------------------------

/** Gatilhos por tese. Casados contra o texto agregado do contexto de geração. */
const THESIS_TRIGGERS: Record<string, RegExp> = {
  justica_gratuita: /gratuidad|justi[çc]a\s+gratuita|hipossufici|desempregad|assist[êe]ncia\s+judici/i,
  honorarios_beneficiario_gratuidade:
    /gratuidad|hipossufici|791-?A|sucumb[êe]nc|honor[áa]rio/i,
  adi_5766: /gratuidad|hipossufici|791-?A|790-?B|sucumb[êe]nc|honor[áa]rio\s+pericial/i,
  correcao_juros_adc_58: /corre[çc][ãa]o\s+monet|juros|atualiza[çc][ãa]o|IPCA|SELIC|ADC\s*58/i,
  trabalho_externo_controle_jornada:
    /externo|art\.?\s*62|rastread|GPS|rota|roteiro|vendedor|motorista|visita[s]?\s+a\s+clientes|jornada/i,
  sumula_338_tst:
    /controle[s]?\s+de\s+(?:ponto|jornada)|cart[õo]es?\s+de\s+ponto|s[úu]mula\s*338|exibi[çc][ãa]o\s+de\s+documento|registro[s]?\s+de\s+jornada|hora[s]?\s+extra/i,
  intervalo_intrajornada: /intrajornada|intervalo|art\.?\s*71|refei[çc][ãa]o\s+e\s+descanso/i,
  rescisao_indireta: /rescis[ãa]o\s+indireta|art\.?\s*483|justa\s+causa\s+do\s+empregador|falta\s+grave\s+patronal/i,
  integracao_remuneracao_variavel:
    /comiss[ãa]o|comiss[õo]es|remunera[çc][ãa]o\s+vari[áa]vel|pr[êe]mi|bonifica|produtividade|parte\s+vari[áa]vel|integra[çc][ãa]o/i,
  honorarios_sucumbenciais: /honor[áa]rio|sucumb[êe]nc|791-?A|art\.?\s*85/i,
  horas_extras_8_44:
    /hora[s]?\s+extra|sobrejornada|jornada\s+extraordin|excedente[s]?\s+d[ao]\s+(?:8|oitava)|44[ªa]\s*(?:hora)?\s*semanal|prorroga[çc][ãa]o\s+de\s+jornada/i,
  art71_faixas_intervalo:
    /intrajornada|intervalo[^.]{0,40}(?:refei[çc][ãa]o|descanso|almo[çc]o)|art\.?\s*71/i,
};

/**
 * Seleciona as teses aplicáveis a partir do material já existente no fluxo de
 * geração (blocos obrigatórios, playbook, subtipo, pedidos e contexto).
 * Determinística: mesma entrada, mesma saída. Nenhuma chamada de IA.
 */
export function selectApplicableTheses(input: {
  /** Textos livres do contexto: fatos, pedidos, claim map, análise, etc. */
  contextTexts?: Array<string | null | undefined>;
  /** Rótulos/ids dos blocos obrigatórios da peça. */
  requiredBlockIds?: Array<string | null | undefined>;
  /** Playbook renderizado para o prompt, quando houver. */
  playbookText?: string | null;
  /** Subtipo do caso (ex.: motorista_profissional). */
  caseSubtype?: string | null;
  /** Área e tipo de peça — hoje as teses cobrem trabalhista/inicial. */
  legalArea?: string | null;
  draftType?: string | null;
}): LegalThesis[] {
  const area = String(input.legalArea ?? "").toLowerCase();
  if (area && !area.includes("trabalh")) return [];

  const haystack = [
    ...(input.contextTexts ?? []),
    ...(input.requiredBlockIds ?? []),
    input.playbookText,
    input.caseSubtype,
  ]
    .filter((s): s is string => typeof s === "string" && s.length > 0)
    .join("\n")
    .slice(0, 200_000);

  if (!haystack.trim()) return [];

  const selected = LEGAL_THESES.filter((t) => {
    const re = THESIS_TRIGGERS[t.key];
    return re ? re.test(haystack) : false;
  });

  // Coerência: a tese do beneficiário da gratuidade e a ADI 5.766 só fazem
  // sentido quando a peça trata de gratuidade OU de honorários.
  const hasGratuidade = selected.some((t) => t.key === "justica_gratuita");
  const hasHonorarios = selected.some((t) => t.key === "honorarios_sucumbenciais");
  return selected.filter((t) => {
    if (t.key === "adi_5766" || t.key === "honorarios_beneficiario_gratuidade") {
      return hasGratuidade || hasHonorarios;
    }
    return true;
  });
}

/** Renderiza o bloco de teses para o prompt. Vazio quando não há tese. */
export function renderThesesForPrompt(theses: LegalThesis[]): string {
  if (!theses.length) return "";
  const body = theses
    .map(
      (t) =>
        `## ${t.title} (${t.key})\n` +
        `Orientação: ${t.guidance}\n` +
        `Base legal/vinculante conferida: ${t.legal_basis.join("; ")}\n` +
        `Conferido em: ${t.reviewed_at}`,
    )
    .join("\n\n");

  return `# TESES JURÍDICAS CONFERIDAS PELO ESCRITÓRIO (matérias já pacificadas)

Estas matérias JÁ ESTÃO conferidas. Regras duras:
- Redija cada uma de forma AFIRMATIVA, aplicando a orientação AOS FATOS CONCRETOS deste caso — é PROIBIDO reproduzir a orientação como texto genérico ou copiá-la literalmente.
- É PROIBIDO inserir "[REVISAR ...]", "[ATUALIZAR ENTENDIMENTO ...]", "[CONFERIR JURISPRUDÊNCIA ...]" ou marcador equivalente nestas matérias.
- Cite apenas a base legal/vinculante listada. NUNCA invente número de processo, relator, órgão julgador ou data de julgamento.
- Se a tese não tiver suporte fático neste caso, simplesmente não a desenvolva — não a mencione com ressalva.

${body}`;
}
