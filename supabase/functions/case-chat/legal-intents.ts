// =============================================================================
// PR-4.2A — Registry declarativo de intenções jurídicas focadas no Chat IA.
//
// Cada intent define:
// - detect: matcher conservador sobre o texto normalizado
// - mode: processual (autos) ou pre_processual (caso novo / sem processo)
// - targetClassifications: classifications priorizadas (vazio = todos os arquivos)
// - queries: multi-query (a pergunta original do usuário é sempre adicionada)
// - promptBlock: bloco extra injetado no system prompt
// - partialityCheck (opcional): heurística para marcar resposta parcial
//
// Fora do registry, o fluxo do Chat IA permanece idêntico (zero regressão).
// =============================================================================

export type IntentMode = "processual" | "pre_processual";

export interface FileMeta {
  id: string;
  classification: string | null;
}

export interface IntentContext {
  hasCaseNumber: boolean;
  filesDone: FileMeta[];
  /** verdadeiro quando há pelo menos um arquivo claramente processual */
  hasProcessualFiles: boolean;
}

export interface ChunkLite {
  content: string;
  page_from: number | null;
}

export interface PromptBlockInfo {
  partial: boolean;
  fallback: boolean;
  integralSectionPresent?: boolean;
  hasCaseNumber: boolean;
  preProcessualContext?: string | null;
}

export interface LegalIntent {
  id: string;
  mode: IntentMode;
  detect: (msgNorm: string, ctx: IntentContext) => boolean;
  targetClassifications: string[];
  queries: string[];
  topKFetch: number;
  topKFinal: number;
  partialityCheck?: (chunks: ChunkLite[]) => boolean;
  promptBlock: (info: PromptBlockInfo) => string;
}

// ---------- Helpers ---------------------------------------------------------

export function stripDiacritics(s: string): string {
  return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeMessage(s: string): string {
  return stripDiacritics((s || "").toLowerCase());
}

/** Classificações consideradas "claramente processuais". */
export const PROCESSUAL_CLASSIFICATIONS = new Set<string>([
  "peticao_inicial",
  "reclamacao_trabalhista",
  "inicial",
  "contestacao",
  "defesa",
  "manifestacao_reclamada",
  "impugnacao",
  "contrarrazoes",
  "sentenca",
  "decisao",
  "acordao",
  "decisao_embargos",
  "sentenca_liquidacao",
  "calculo",
  "planilha_calculo",
  "liquidacao",
  "impugnacao_calculos",
  "embargos_execucao",
  "parecer_contador",
  "agravo_peticao",
  "laudo_pericial",
  "pericia",
  "laudo_medico",
  "laudo_tecnico",
  "quesitos",
  "manifestacao_laudo",
  "impugnacao_laudo",
  "recurso",
  "recurso_ordinario",
  "recurso_revista",
  "agravo",
]);

export function hasProcessualFiles(files: FileMeta[]): boolean {
  return files.some((f) =>
    f.classification ? PROCESSUAL_CLASSIFICATIONS.has(f.classification) : false
  );
}

/** Retorna os file_ids cuja classification pertence ao conjunto pedido. */
export function filterFileIds(
  files: FileMeta[],
  targets: string[]
): Set<string> {
  if (!targets.length) return new Set(files.map((f) => f.id));
  const set = new Set(targets);
  return new Set(
    files.filter((f) => f.classification && set.has(f.classification)).map((f) => f.id)
  );
}

const RE_INTEGRAL_PEDIDOS = /(diante do (?:todo )?exposto|ante o exposto|isso posto)/i;
const RE_PEDID = /pedid/i;
const RE_DISPOSITIVO = /(diante do (?:todo )?exposto|ante o exposto|isso posto|julg[oa] (?:procedente|improcedente|parcialmente)|dispositivo)/i;
const RE_CONTEST_HEADER = /(contesta[cç][aã]o|em sede de defesa|preliminarmente|no m[eé]rito)/i;
const RE_LAUDO_CONCLUSAO = /(conclus[aã]o|conclui[- ]se|respostas? aos quesitos|em resposta aos quesitos)/i;
const RE_VALOR_TOTAL = /(valor total|valor atualizado|montante|total apurado|total devido|valor da execu[cç][aã]o)/i;

// ---------- Common prompt builders ------------------------------------------

const MODE_PROCESSUAL_HEADER = `--- MODO: PROCESSO JUDICIAL EXISTENTE ---
Responda com base nos documentos processuais recuperados.
Priorize documentos classificados conforme a intenção detectada.
Não afirme completude se a íntegra do documento principal não foi localizada.
Se os trechos forem insuficientes, inicie com aviso de parcialidade.
Cite fontes sempre que possível, no formato [<Tipo> · <arquivo> · pp. X–Y].
Não invente fundamentos, valores, pedidos ou conclusões.`;

const MODE_PRE_PROCESSUAL_HEADER = `--- MODO: CASO NOVO / PRÉ-PROCESSUAL ---
Responda com base na ficha, relato, interações e documentos disponíveis.
Não trate hipóteses como fatos comprovados.
Diferencie sempre:
- fatos relatados pelo cliente;
- documentos efetivamente existentes;
- hipóteses jurídicas;
- pontos que dependem de prova;
- perguntas ainda pendentes ao cliente.
Use linguagem cautelosa: "Com base no relato...", "Em análise preliminar...",
"Depende de confirmação...", "Não identifiquei documento suficiente para concluir...".
Não invente datas, valores, funções, salários, jornadas ou doenças.`;

function partialWarning(intent: string, partial: boolean, fallback: boolean): string {
  if (!partial && !fallback) return "";
  if (fallback) {
    return `\n\n⚠️ Resposta parcial — não localizei documentos focados de ${intent} nos autos processados. Responda apenas com o que estiver claramente nos trechos recuperados; sinalize lacunas.`;
  }
  return `\n\n⚠️ Resposta parcial — não localizei a íntegra do documento principal nos trechos recuperados.`;
}

function preContextBlock(ctx?: string | null): string {
  if (!ctx) return "";
  return `\n\n--- CONTEXTO PRÉ-PROCESSUAL DISPONÍVEL ---\n${ctx}`;
}

// ---------- Registry ---------------------------------------------------------

export const LEGAL_INTENTS: LegalIntent[] = [
  // -----------------------------------------------------------------
  // 0. PEDIDOS DA INICIAL (intent existente, preservada)
  // -----------------------------------------------------------------
  {
    id: "pedidos_iniciais",
    mode: "processual",
    detect: (m, ctx) => {
      if (!ctx.hasProcessualFiles) return false;
      const strong = [
        /\bpedidos?\b.*\b(inicial|petic|autor|reclamante|formulad)/,
        /\b(inicial|petic\w*)\b.*\bpedidos?\b/,
        /\brol\s+de\s+pedidos\b/,
        /\bo\s+que\s+(se\s+pede|foi\s+pedido|a\s+inicial\s+pede)\b/,
        /\brequerimentos?\b.*\b(inicial|autor|reclamante|petic)/,
        /\bpetic\w*\s+inicial\b.*\b(pede|pedidos?|requer)/,
      ];
      return strong.some((re) => re.test(m));
    },
    targetClassifications: ["peticao_inicial", "reclamacao_trabalhista", "inicial"],
    queries: [
      "pedidos formulados na petição inicial, requerimentos finais",
      "diante do exposto, requer-se condenação da ré",
      "verbas pleiteadas, justiça gratuita, honorários sucumbenciais",
    ],
    topKFetch: 12,
    topKFinal: 10,
    partialityCheck: (chunks) =>
      chunks.some((c) => RE_INTEGRAL_PEDIDOS.test(c.content) && RE_PEDID.test(c.content)),
    promptBlock: (info) => {
      const integral = info.integralSectionPresent ? "sim" : "não";
      return `--- MODO: LISTAR PEDIDOS DA PETIÇÃO INICIAL ---
Seção "Diante do exposto" presente nos trechos: ${integral}

Responda em LISTA NUMERADA, um item por pedido principal, subsidiário ou acessório identificado.

Inclua, quando constarem nos trechos recuperados:
- pedidos preliminares (ex.: justiça gratuita);
- pedidos de mérito;
- verbas pleiteadas;
- reflexos;
- honorários;
- juros e correção monetária;
- requerimentos processuais (citação, provas, ofícios).

Cite a fonte em cada item, no formato:
[Petição Inicial · arquivo · p. X]

Não invente pedidos.

Se a seção "DOS PEDIDOS", "Diante do exposto", "Ante o exposto" ou equivalente não estiver integralmente nos trechos recuperados, inicie a resposta com:
"⚠️ Resposta parcial — não localizei a seção integral de pedidos nos trechos recuperados. Pedidos identificados até aqui:"

Ao final, inclua:
"### Possíveis lacunas"

Não afirme completude quando houver dúvida sobre a integralidade da seção de pedidos.`;
    },
  },

  // -----------------------------------------------------------------
  // 1. SENTENÇA
  // -----------------------------------------------------------------
  {
    id: "sentenca",
    mode: "processual",
    detect: (m, ctx) => {
      if (!ctx.hasProcessualFiles) return false;
      const re = [
        /\bresum[ae]\s+(a\s+)?senten[cç]a\b/,
        /\bo\s+que\s+decidiu\s+(a\s+)?senten[cç]a\b/,
        /\bqual\s+(foi\s+)?o?\s*dispositivo\b/,
        /\bpedidos?\s+(foram\s+)?(deferidos?|rejeitados?|indeferidos?|julgados?)/,
        /\bfundamentos?\s+da\s+senten[cç]a\b/,
        /\bjulg[ao]u\s+(procedente|improcedente|parcialmente)/,
        /\b(o\s+que\s+)?recorrer\s+da\s+senten[cç]a\b/,
        /\bac[oó]rd[aã]o\b/,
      ];
      return re.some((r) => r.test(m));
    },
    targetClassifications: [
      "sentenca",
      "decisao",
      "acordao",
      "decisao_embargos",
      "sentenca_liquidacao",
    ],
    queries: [
      "sentença dispositivo procedência improcedência pedidos deferidos rejeitados",
      "fundamentos da sentença condenação absolvição julgamento",
      "diante do exposto julgo procedente julgo improcedente dispositivo",
      "pontos para recurso fundamentos atacáveis sentença",
    ],
    topKFetch: 12,
    topKFinal: 8,
    partialityCheck: (chunks) => chunks.some((c) => RE_DISPOSITIVO.test(c.content)),
    promptBlock: (info) => {
      const warn = info.integralSectionPresent === false
        ? `\n⚠️ Inicie a resposta com: "⚠️ Resposta parcial — não localizei a íntegra da sentença/dispositivo nos trechos recuperados."`
        : "";
      return `${MODE_PROCESSUAL_HEADER}

--- INTENT: SENTENÇA ---
Estruture a resposta exatamente assim:

### Resumo da sentença
### Pedidos deferidos
### Pedidos rejeitados
### Fundamentos principais
### Dispositivo
### Pontos favoráveis
### Pontos atacáveis / atenção para recurso
### Observação de cautela
${warn}${partialWarning("sentença", info.partial, info.fallback)}`;
    },
  },

  // -----------------------------------------------------------------
  // 2. CONTESTAÇÃO / DEFESA
  // -----------------------------------------------------------------
  {
    id: "contestacao_defesa",
    mode: "processual",
    detect: (m, ctx) => {
      if (!ctx.hasProcessualFiles) return false;
      const re = [
        /\bargumentos?\s+da\s+defesa\b/,
        /\b(a\s+)?reclamada\s+aleg/,
        /\b(a\s+)?r[eé]\s+aleg/,
        /\bresum[ae]\s+(a\s+)?contesta[cç][aã]o\b/,
        /\bpreliminares?\s+(apresentadas?|alegadas?|arguidas?)/,
        /\bimpugnar?\s+(a\s+)?contesta[cç][aã]o\b/,
        /\bpontos?\s+da\s+inicial\s+foram\s+impugnados?\b/,
        /\bdocumentos\s+(a\s+)?defesa\s+usou\b/,
      ];
      return re.some((r) => r.test(m));
    },
    targetClassifications: [
      "contestacao",
      "defesa",
      "manifestacao_reclamada",
      "impugnacao",
      "contrarrazoes",
    ],
    queries: [
      "contestação preliminares defesa de mérito impugnação específica",
      "a reclamada alega a ré sustenta defesa quanto aos pedidos",
      "documentos juntados pela defesa impugnação aos fatos",
      "preliminares mérito prescrição inépcia ilegitimidade",
    ],
    topKFetch: 12,
    topKFinal: 8,
    partialityCheck: (chunks) => chunks.some((c) => RE_CONTEST_HEADER.test(c.content)),
    promptBlock: (info) => `${MODE_PROCESSUAL_HEADER}

--- INTENT: CONTESTAÇÃO / DEFESA ---
Estruture a resposta exatamente assim:

### Preliminares alegadas
### Defesa de mérito
### Impugnação aos pedidos
### Documentos usados pela defesa
### Pontos frágeis da defesa
### Sugestão de impugnação
### Observação de cautela

Se a íntegra da contestação não estiver nos trechos, inicie com:
"⚠️ Resposta parcial — não localizei a íntegra da contestação/defesa nos trechos recuperados."${partialWarning("contestação", info.partial, info.fallback)}`,
  },

  // -----------------------------------------------------------------
  // 3. CÁLCULOS / EXECUÇÃO
  // -----------------------------------------------------------------
  {
    id: "calculos_execucao",
    mode: "processual",
    detect: (m, ctx) => {
      if (!ctx.hasProcessualFiles) return false;
      const re = [
        /\bvalor\s+(atualizado|da\s+execu[cç][aã]o|dos\s+c[aá]lculos|incontroverso)\b/,
        /\bquais?\s+verbas?\s+comp[oõ]e/,
        /\bdiferen[cç]a\s+entre\s+os\s+c[aá]lculos\b/,
        /\bo\s+contador\s+apur/,
        /\bconsta\s+na\s+liquida[cç][aã]o\b/,
        /\bparcelas?\s+foram\s+calculadas?\b/,
        /\bplanilha\s+de\s+c[aá]lculos?\b/,
      ];
      return re.some((r) => r.test(m));
    },
    targetClassifications: [
      "calculo",
      "planilha_calculo",
      "sentenca_liquidacao",
      "liquidacao",
      "impugnacao_calculos",
      "embargos_execucao",
      "parecer_contador",
      "agravo_peticao",
    ],
    queries: [
      "valor atualizado execução cálculo liquidação total apurado",
      "planilha de cálculos verbas principal juros correção FGTS INSS",
      "diferença entre cálculos contador impugnação cálculos valor incontroverso",
      "sentença de liquidação embargos à execução impugnação à liquidação",
    ],
    topKFetch: 12,
    topKFinal: 8,
    partialityCheck: (chunks) => chunks.some((c) => RE_VALOR_TOTAL.test(c.content)),
    promptBlock: (info) => `${MODE_PROCESSUAL_HEADER}

--- INTENT: CÁLCULOS / EXECUÇÃO ---
REGRA CRÍTICA DE CAUTELA EM CÁLCULOS:
- NÃO invente valores.
- NÃO some valores sem base expressa nos trechos.
- NÃO afirme "valor final" ou "valor atualizado" sem planilha clara ou trecho que diga isso textualmente.
- Se só houver valor parcial, NÃO chame de "valor atualizado".

Estruture a resposta exatamente assim:

### Valor identificado
### Composição do cálculo
### Verbas incluídas
### Pontos controvertidos
### Diferenças entre cálculos, se houver
### Próxima providência
### Observação de cautela

Se a planilha integral ou o valor atualizado claro não estiverem nos trechos, inicie com:
"⚠️ Resposta parcial — identifiquei apenas parte das informações de cálculo. Recomenda-se conferência da planilha integral antes de usar qualquer valor."${partialWarning("cálculos", info.partial, info.fallback)}`,
  },

  // -----------------------------------------------------------------
  // 4. LAUDO PERICIAL
  // -----------------------------------------------------------------
  {
    id: "laudo_pericial",
    mode: "processual",
    detect: (m, ctx) => {
      if (!ctx.hasProcessualFiles) return false;
      const re = [
        /\bo\s+que\s+diz\s+o\s+laudo\b/,
        /\bconclus[aã]o\s+do\s+perito\b/,
        /\blaudo\s+(e|é)\s+favor[aá]vel\b/,
        /\bimpugnar?\s+o\s+laudo\b/,
        /\bh[aá]\s+(insalubridade|periculosidade|nexo\s+causal)/,
        /\bconclus[aã]o\s+m[eé]dica\b/,
        /\bdoen[cç]a\s+ocupacional\b/,
        /\bpericial?\b.*\b(conclus|favor|impugn)/,
      ];
      return re.some((r) => r.test(m));
    },
    targetClassifications: [
      "laudo_pericial",
      "pericia",
      "laudo_medico",
      "laudo_tecnico",
      "quesitos",
      "manifestacao_laudo",
      "impugnacao_laudo",
    ],
    queries: [
      "laudo pericial conclusão do perito resposta aos quesitos",
      "insalubridade periculosidade nexo causal incapacidade doença ocupacional",
      "conclusão pericial favorável desfavorável impugnação ao laudo",
      "quesitos perito vistoria análise técnica",
    ],
    topKFetch: 12,
    topKFinal: 8,
    partialityCheck: (chunks) => chunks.some((c) => RE_LAUDO_CONCLUSAO.test(c.content)),
    promptBlock: (info) => `${MODE_PROCESSUAL_HEADER}

--- INTENT: LAUDO PERICIAL ---
Estruture a resposta exatamente assim:

### Objeto da perícia
### Conclusão do perito
### Pontos favoráveis
### Pontos desfavoráveis
### Contradições ou omissões
### Possibilidade de impugnação
### Próxima providência
### Observação de cautela

Se a conclusão integral do laudo não estiver nos trechos, inicie com:
"⚠️ Resposta parcial — não localizei a conclusão integral do laudo pericial nos trechos recuperados."${partialWarning("laudo pericial", info.partial, info.fallback)}`,
  },

  // -----------------------------------------------------------------
  // 5. ANÁLISE DE CASO NOVO
  // -----------------------------------------------------------------
  {
    id: "analise_caso_novo",
    mode: "pre_processual",
    detect: (m, ctx) => {
      if (ctx.hasProcessualFiles && ctx.hasCaseNumber) return false;
      const re = [
        /\banalise\s+(esse|este|o)?\s*caso\b/,
        /\b(esse|este)\s+caso\s+e\s+vi[aá]vel\b/,
        /\bqual\s+a\s+viabilidade\b/,
        /\bquais\s+direitos\s+(o\s+)?cliente\b/,
        /\bqual\s+tese\s+cab/,
        /\bqual\s+estrat[eé]gia\b/,
        /\bvale\s+a\s+pena\s+(entrar\s+com|ajuizar)\b/,
        /\bo\s+relato\s+e\s+suficiente\b/,
      ];
      return re.some((r) => r.test(m));
    },
    targetClassifications: [],
    queries: [
      "relato do cliente entrevista ficha fatos narrados",
      "direitos possíveis tese jurídica viabilidade",
      "documentos do cliente provas iniciais holerites contrato CAT atestado",
      "estratégia para inicial pontos fortes fragilidades",
    ],
    topKFetch: 12,
    topKFinal: 8,
    promptBlock: (info) => `${MODE_PRE_PROCESSUAL_HEADER}
${preContextBlock(info.preProcessualContext)}

--- INTENT: ANÁLISE DE CASO NOVO ---
Estruture a resposta exatamente assim:

### Análise pré-processual
### Resumo do relato do cliente
### Direitos ou teses possíveis
### Pontos fortes
### Riscos e fragilidades
### Documentos já existentes
### Documentos faltantes
### Provas necessárias
### Perguntas pendentes para o cliente
### Próxima providência
### Peça recomendada
### Nível de confiança

Inicie, quando aplicável, com:
"Análise preliminar com base na ficha, relato e documentos disponíveis."

Se houver poucos dados, inicie com:
"⚠️ Análise preliminar — ainda não há documentos/texto suficiente para conclusão completa."${partialWarning("análise pré-processual", info.partial, info.fallback)}`,
  },

  // -----------------------------------------------------------------
  // 6. PEDIDOS POSSÍVEIS PARA A INICIAL
  // -----------------------------------------------------------------
  {
    id: "pedidos_possiveis_inicial",
    mode: "pre_processual",
    detect: (m, ctx) => {
      // Conservador: só ativa quando NÃO há petição inicial classificada.
      if (ctx.hasProcessualFiles && ctx.hasCaseNumber) return false;
      const re = [
        /\bquais\s+pedidos?\s+(posso|poderia|cabem|colocar)\b/,
        /\bo\s+que\s+(posso|poderia)\s+pedir\b/,
        /\bquais?\s+verbas?\s+pedir\b/,
        /\bquais?\s+direitos?\s+colocar\s+na\s+inicial\b/,
        /\bquais?\s+pedidos?\s+trabalhistas?\s+cabem\b/,
        /\bpedidos?\s+poss[ií]veis?\b/,
      ];
      return re.some((r) => r.test(m));
    },
    targetClassifications: [],
    queries: [
      "pedidos possíveis verbas trabalhistas direitos do cliente",
      "horas extras adicional insalubridade FGTS rescisão indireta",
      "danos morais indenização equiparação salarial",
      "documentos do cliente fundamentando pedidos",
    ],
    topKFetch: 12,
    topKFinal: 8,
    promptBlock: (info) => `${MODE_PRE_PROCESSUAL_HEADER}
${preContextBlock(info.preProcessualContext)}

--- INTENT: PEDIDOS POSSÍVEIS PARA A INICIAL ---
ATENÇÃO: NÃO são pedidos já formulados — são pedidos POSSÍVEIS, sujeitos a confirmação.
Use sempre linguagem cautelosa:
"Com base no relato e documentos disponíveis...", "Em tese, pode ser avaliado...",
"Depende de confirmação documental/testemunhal...", "Antes da inicial, recomenda-se confirmar...".

Estruture a resposta exatamente assim:

### Pedidos possíveis para a inicial
1. Pedido possível
   - Fundamento fático identificado:
   - Documento/prova existente:
   - Documento/prova faltante:
   - Cautela:

### Pedidos que dependem de confirmação
### Pedidos que não recomendo por ora
### Documentos necessários antes da inicial
### Observação de cautela

Não apresente como pedido certo se faltar prova.${partialWarning("pedidos possíveis", info.partial, info.fallback)}`,
  },

  // -----------------------------------------------------------------
  // 7. DOCUMENTOS FALTANTES PARA A INICIAL
  // -----------------------------------------------------------------
  {
    id: "documentos_faltantes_inicial",
    mode: "pre_processual",
    detect: (m, ctx) => {
      if (ctx.hasProcessualFiles && ctx.hasCaseNumber) return false;
      const re = [
        /\bquais\s+documentos?\s+(faltam|pedir|preciso|necess|devo\s+pedir)/,
        /\bo\s+que\s+preciso\s+juntar\s+(para|antes\s+da)\s+inicial\b/,
        /\bquais\s+provas?\s+faltam\b/,
        /\bque\s+documentos?\s+preciso\s+antes\s+de\s+(entrar|ajuizar)\b/,
        /\bchecklist\s+(de\s+)?documentos?\b/,
      ];
      return re.some((r) => r.test(m));
    },
    targetClassifications: [],
    queries: [
      "documentos necessários para petição inicial",
      "holerites TRCT contrato CTPS CAT atestado",
      "provas documentais trabalhistas",
      "documentos do cliente já entregues",
    ],
    topKFetch: 10,
    topKFinal: 6,
    promptBlock: (info) => `${MODE_PRE_PROCESSUAL_HEADER}
${preContextBlock(info.preProcessualContext)}

--- INTENT: DOCUMENTOS FALTANTES PARA A INICIAL ---
Formato preferencial: CHECKLIST.

Estruture a resposta exatamente assim:

### Documentos faltantes prioritários
- [ ] item

### Documentos úteis, mas não indispensáveis
- [ ] item

### Provas que podem substituir documentos
### Perguntas ao cliente relacionadas aos documentos
### Próxima providência${partialWarning("documentos faltantes", info.partial, info.fallback)}`,
  },

  // -----------------------------------------------------------------
  // 8. PERGUNTAS PARA O CLIENTE
  // -----------------------------------------------------------------
  {
    id: "perguntas_para_cliente",
    mode: "pre_processual",
    detect: (m, ctx) => {
      if (ctx.hasProcessualFiles && ctx.hasCaseNumber) return false;
      const re = [
        /\bo\s+que\s+preciso\s+perguntar\s+ao\s+cliente\b/,
        /\bquais\s+perguntas\s+fazer\s+ao\s+cliente\b/,
        /\bque\s+informa[cç][oõ]es\s+faltam\b/,
        /\bo\s+que\s+falta\s+esclarecer\b/,
        /\bquais\s+d[uú]vidas\s+preciso\s+tirar\s+com\s+o\s+cliente\b/,
      ];
      return re.some((r) => r.test(m));
    },
    targetClassifications: [],
    queries: [
      "informações faltantes do cliente entrevista",
      "perguntas sobre contrato jornada remuneração verbas",
      "perguntas sobre testemunhas e documentos",
    ],
    topKFetch: 10,
    topKFinal: 6,
    promptBlock: (info) => `${MODE_PRE_PROCESSUAL_HEADER}
${preContextBlock(info.preProcessualContext)}

--- INTENT: PERGUNTAS PARA O CLIENTE ---
Estruture a resposta com os blocos abaixo (adapte conforme o tipo de caso identificado):

### Perguntas essenciais
### Perguntas sobre contrato/período
### Perguntas sobre jornada
### Perguntas sobre remuneração/verbas
### Perguntas sobre documentos/provas
### Perguntas sobre testemunhas
### Perguntas sobre riscos${partialWarning("perguntas ao cliente", info.partial, info.fallback)}`,
  },

  // -----------------------------------------------------------------
  // 9. PROVAS NECESSÁRIAS
  // -----------------------------------------------------------------
  {
    id: "provas_necessarias",
    mode: "pre_processual",
    detect: (m, ctx) => {
      // Conservador: exige termo explícito de prova/provar.
      if (ctx.hasProcessualFiles && ctx.hasCaseNumber) return false;
      const re = [
        /\bquais\s+provas\s+preciso\b/,
        /\bo\s+que\s+preciso\s+provar\b/,
        /\bquais\s+provas\s+sustentam\s+a\s+tese\b/,
        /\bquais\s+documentos\s+ajudam\b/,
        /\bpreciso\s+de\s+testemunha\b/,
        /\bo\s+que\s+falta\s+provar\b/,
      ];
      return re.some((r) => r.test(m));
    },
    targetClassifications: [],
    queries: [
      "fatos que precisam ser provados ônus da prova",
      "provas documentais testemunhais periciais",
      "prova de jornada horas extras testemunhas",
    ],
    topKFetch: 10,
    topKFinal: 6,
    promptBlock: (info) => `${MODE_PRE_PROCESSUAL_HEADER}
${preContextBlock(info.preProcessualContext)}

--- INTENT: PROVAS NECESSÁRIAS ---
Estruture a resposta exatamente assim:

### Fatos que precisam ser provados
### Provas documentais úteis
### Provas testemunhais úteis
### Provas técnicas/periciais, se aplicável
### Provas já existentes
### Provas faltantes
### Risco probatório${partialWarning("provas necessárias", info.partial, info.fallback)}`,
  },

  // -----------------------------------------------------------------
  // 10. RISCOS PRÉ-PROCESSUAIS
  // -----------------------------------------------------------------
  {
    id: "riscos_pre_processuais",
    mode: "pre_processual",
    detect: (m, ctx) => {
      // Conservador: exige termo de risco/fragilidade.
      if (ctx.hasProcessualFiles && ctx.hasCaseNumber) return false;
      const re = [
        /\bquais\s+(os\s+)?riscos?\s+desse\s+caso\b/,
        /\brisco\s+de\s+improcedencia\b/,
        /\bo\s+que\s+pode\s+dar\s+errado\b/,
        /\bquais\s+pontos?\s+fracos?\b/,
        /\bquais\s+fragilidades?\s+(antes\s+da\s+inicial)?\b/,
      ];
      return re.some((r) => r.test(m));
    },
    targetClassifications: [],
    queries: [
      "riscos do caso pontos fracos improcedência",
      "prescrição decadência prazos",
      "risco probatório jurídico econômico",
    ],
    topKFetch: 10,
    topKFinal: 6,
    promptBlock: (info) => `${MODE_PRE_PROCESSUAL_HEADER}
${preContextBlock(info.preProcessualContext)}

--- INTENT: RISCOS PRÉ-PROCESSUAIS ---
Estruture a resposta exatamente assim:

### Principais riscos
### Riscos de prova
### Riscos jurídicos
### Riscos de prescrição/decadência
### Riscos econômicos
### Como reduzir os riscos
### Nível de cautela${partialWarning("riscos", info.partial, info.fallback)}`,
  },
];

/**
 * Resolve a primeira intent compatível na ordem do registry.
 * Conservador: na ausência de match, retorna null → fluxo padrão.
 */
export function resolveIntent(message: string, ctx: IntentContext): LegalIntent | null {
  const m = normalizeMessage(message);
  for (const intent of LEGAL_INTENTS) {
    try {
      if (intent.detect(m, ctx)) return intent;
    } catch {
      // detector defensivo — segue para o próximo
    }
  }
  return null;
}
