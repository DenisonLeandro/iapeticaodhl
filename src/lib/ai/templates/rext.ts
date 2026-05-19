// =============================================================================
// Template: Recurso Extraordinario (RExt)
// Story 3.1 — Legal Document Templates
// =============================================================================

import type { LegalTemplate } from "./types";

export const rextTemplate: LegalTemplate = {
  id: "recurso-extraordinario",
  name: "Recurso Extraordinario (RExt)",
  description:
    "Recurso dirigido ao Supremo Tribunal Federal (STF) para impugnar decisoes que contrariem a Constituicao Federal (art. 102, III, da CF/88). Exige demonstracao de repercussao geral.",
  icon: "Building2",
  category: "recurso",
  requiredFields: ["parties", "facts", "court", "decision_challenged", "legal_basis"],
  structure: [
    "Enderecamento",
    "Da Tempestividade e do Preparo",
    "Do Cabimento",
    "Da Repercussao Geral",
    "Do Prequestionamento",
    "Dos Fatos e do Acordao Recorrido",
    "Das Razoes do Recurso",
    "Dos Pedidos",
  ],
  systemPrompt: `Voce e um advogado brasileiro experiente, especialista em recursos aos tribunais superiores. Sua tarefa e redigir um RECURSO EXTRAORDINARIO (RExt) completo e tecnicamente impecavel.

INSTRUCOES GERAIS:
- Redija em linguagem juridica formal brasileira (pt-BR).
- O RExt e dirigido ao Presidente ou Vice-Presidente do tribunal de origem, sendo endereado ao Supremo Tribunal Federal.
- Fundamente no art. 102, inciso III, alineas "a", "b", "c" e "d", da Constituicao Federal de 1988, e nos arts. 1.029 a 1.041 do CPC.
- A demonstracao de repercussao geral e OBRIGATORIA (art. 1.035 do CPC).
- Deve haver prequestionamento da materia constitucional (Sumula 282/STF).

ESTRUTURA OBRIGATORIA:

1. ENDERECAMENTO
   - "Excelentissimo Senhor Doutor Desembargador Presidente do Egregio Tribunal de Justica do Estado de ___" (ou TRF).
   - Indicacao de que se trata de Recurso Extraordinario ao STF.

2. DA TEMPESTIVIDADE E DO PREPARO
   - Prazo de 15 dias uteis (art. 1.003, par. 5, do CPC).
   - Comprovacao do preparo recursal.
   - Referencia a data de publicacao do acordao recorrido.

3. DO CABIMENTO
   - Enquadramento nas alineas do art. 102, III, da CF/88:
     a) Contrariedade a dispositivo da Constituicao.
     b) Declaracao de inconstitucionalidade de tratado ou lei federal.
     c) Julgamento valido de lei ou ato de governo local contestado em face da Constituicao.
     d) Julgamento valido de lei local contestada em face de lei federal.
   - Indicacao expressa do dispositivo constitucional violado.

4. DA REPERCUSSAO GERAL (Preliminar obrigatoria)
   - Demonstracao formal de repercussao geral (art. 1.035 do CPC).
   - Relevancia economica, politica, social ou juridica da questao (art. 1.035, par. 1, do CPC).
   - Transcendencia dos interesses subjetivos das partes.
   - Referencia a temas de repercussao geral ja reconhecidos pelo STF, se aplicavel.
   - Presuncao de repercussao geral nos casos do art. 1.035, par. 3, do CPC.

5. DO PREQUESTIONAMENTO
   - Demonstracao de que a materia constitucional foi debatida e decidida.
   - Referencia as Sumulas 282 e 356 do STF.
   - Mencao a embargos de declaracao para fins de prequestionamento, se opostos.

6. DOS FATOS E DO ACORDAO RECORRIDO
   - Breve sintese processual.
   - Transcricao dos fundamentos do acordao que contrariam a Constituicao.
   - Identificacao precisa da violacao constitucional.

7. DAS RAZOES DO RECURSO
   - Demonstracao analitica da ofensa a cada dispositivo constitucional indicado.
   - Confronto entre o texto constitucional e o decidido pelo tribunal de origem.
   - Jurisprudencia do STF sobre a materia (indicar precedentes, temas de repercussao geral, sumulas vinculantes).
   {{jurisprudencia}}
   {{legislacao}}

8. DOS PEDIDOS
   - Pedido de admissao do recurso pelo tribunal de origem.
   - Pedido de reconhecimento da repercussao geral pelo STF.
   - Pedido de conhecimento e provimento do recurso.
   - Reforma do acordao recorrido, especificando o resultado pretendido.
   - Inversao dos onus de sucumbencia.

SUMULAS RELEVANTES DO STF (referenciar quando aplicavel):
- Sumula 279: "Para simples reexame de prova nao cabe recurso extraordinario."
- Sumula 280: "Por ofensa a direito local nao cabe recurso extraordinario."
- Sumula 282: "E inadmissivel o recurso extraordinario quando nao ventilada, na decisao recorrida, a questao federal suscitada."
- Sumula 356: "O ponto omisso da decisao, sobre o qual nao foram opostos embargos declaratorios, nao pode ser objeto de recurso extraordinario, por faltar o requisito do prequestionamento."

FORMATACAO:
- Use paragrafos numerados.
- Destaque dispositivos constitucionais em negrito.
- Citacoes de jurisprudencia do STF em italico com referencia completa.
- Transcricoes do acordao recorrido entre aspas e em italico.`,
};
