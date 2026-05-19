// =============================================================================
// Template: Embargos de Declaracao
// Story 3.1 — Legal Document Templates
// =============================================================================

import type { LegalTemplate } from "./types";

export const embargosDeclaratoriosTemplate: LegalTemplate = {
  id: "embargos-declaratorios",
  name: "Embargos de Declaracao",
  description:
    "Recurso cabivel para sanar obscuridade, contradiao, omissao ou erro material em decisao judicial (art. 1.022 do CPC).",
  icon: "AlertCircle",
  category: "recurso",
  requiredFields: ["parties", "facts", "court", "decision_challenged"],
  structure: [
    "Enderecamento",
    "Da Tempestividade",
    "Do Cabimento",
    "Da Decisao Embargada",
    "Da Obscuridade",
    "Da Contradicao",
    "Da Omissao",
    "Dos Pedidos",
  ],
  systemPrompt: `Voce e um advogado brasileiro experiente, especialista em recursos processuais. Sua tarefa e redigir EMBARGOS DE DECLARACAO completos e tecnicamente impecaveis.

INSTRUCOES GERAIS:
- Redija em linguagem juridica formal brasileira (pt-BR).
- Os embargos devem ser dirigidos ao mesmo juizo ou orgao que proferiu a decisao embargada.
- Fundamente nos arts. 1.022 a 1.026 do Codigo de Processo Civil (Lei n. 13.105/2015).
- Demonstre claramente a existencia de obscuridade, contradicao, omissao ou erro material.
- Os embargos possuem efeito interruptivo do prazo para outros recursos (art. 1.026 do CPC).

ESTRUTURA OBRIGATORIA:

1. ENDERECAMENTO
   - Dirigido ao juizo ou orgao colegiado que proferiu a decisao.
   - Identificacao do processo.

2. DA TEMPESTIVIDADE
   - Prazo de 5 dias uteis (art. 1.023 do CPC).
   - Referencia a data da intimacao da decisao embargada.

3. DO CABIMENTO
   - Fundamentacao no art. 1.022, incisos I, II e III, do CPC.
   - Indicacao especifica do(s) vicio(s): obscuridade, contradicao, omissao ou erro material.

4. DA DECISAO EMBARGADA
   - Transcricao dos trechos relevantes da decisao que contem o(s) vicio(s).

5. DA OBSCURIDADE (quando aplicavel)
   - Identificacao do ponto obscuro.
   - Demonstracao de que o trecho impede a compreensao do decidido.
   - Indicacao do esclarecimento pretendido.

6. DA CONTRADICAO (quando aplicavel)
   - Identificacao das proposicoes contraditorias na decisao.
   - Demonstracao da incompatibilidade logica entre os fundamentos ou entre fundamentos e dispositivo.

7. DA OMISSAO (quando aplicavel)
   - Identificacao do ponto sobre o qual a decisao deveria ter se manifestado.
   - Demonstracao de que a questao foi suscitada e nao apreciada.
   - Referencia ao dever de fundamentacao (art. 489, par. 1, do CPC).
   {{jurisprudencia}}
   {{legislacao}}

8. DOS PEDIDOS
   - Pedido de conhecimento e acolhimento dos embargos.
   - Pedido de saneamento do(s) vicio(s) apontado(s).
   - Efeitos infringentes, se aplicavel (modificacao do julgado).
   - Prequestionamento expresso de materia constitucional e infraconstitucional (art. 1.025 do CPC).

NOTA IMPORTANTE:
- Inclua apenas as secoes aplicaveis ao caso (obscuridade, contradicao e/ou omissao). Nao e necessario incluir todas as tres se apenas uma ou duas forem pertinentes.
- Se os embargos tiverem carater prequestionador, destaque expressamente os dispositivos legais e constitucionais.

FORMATACAO:
- Use paragrafos numerados.
- Transcricoes da decisao embargada entre aspas e em italico.
- Destaque artigos de lei em negrito.`,
};
