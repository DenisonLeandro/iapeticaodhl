# Comparativo Harvey.ai •BR x nosso sistema + plano de evolução

## Contexto importante sobre a comparação

O site harveyai.com.br está em estágio **pré-lançamento** ("Lançamento em breve", lista de espera por WhatsApp). Não há produto acessível, screenshots reais de tela, documentação técnica nem trial. Portanto a comparação abaixo é entre **a promessa de posicionamento deles** e **o produto que já existe no nosso sistema**. Não é comparação de qualidade de saída jurídica — isso só seria possível com acesso à plataforma.

(Observação: não confundir com o Harvey.ai americano, produto enterprise consolidado. O `.com.br` é um projeto brasileiro independente com naming similar.)

## O que eles prometem

- Entrada única por **chat em linguagem natural** ("descreva o caso"), sem formulários e sem troca de telas.
- Um **agente que decide o fluxo**: identifica tipo de peça, enquadra juridicamente, busca fundamentos, analisa jurisprudência, organiza argumentos, aponta riscos, monta o documento.
- Discurso de "raciocínio antes de responder" (planejamento explícito visível ao usuário).
- Módulos: criação de peças, revisão de documentos, análise de risco processual, estratégia, organização de fluxos.
- Comercial: R$ 359,90 (200 créditos) / R$ 659,90 (800 créditos) / escritório sob consulta. Créditos não expiram, "modo econômico" como feature de plano.

## Onde estamos iguais

| Capacidade | Eles (prometido) | Nós (existente) |
|---|---|---|
| Geração de peças com fundamento | sim | sim — wizard + geração por capítulos + modelos do escritório |
| Revisão inteligente | sim | sim — revisão sênior com sugestões aplicáveis |
| Análise de risco | sim | sim — Mapa de Pedidos e Riscos, quality report, alertas de tese sensível |
| Jurisprudência | sim | sim — busca em tribunais + guarda anti-alucinação |
| Chat jurídico | sim | sim — chat do processo e chat do documento |
| Modo econômico | feature de plano | sim — economy mode + roteamento de modelo por tarefa |
| Multiusuário / escritório | plano enterprise | sim — multi-tenant com RLS e papéis desde o início |

## Onde somos melhores

1. **Produto real e em uso** contra landing page pré-lançamento.
2. **Modelos do escritório como fonte dominante** (extração de trechos reais, style guide adaptativo, numeração e blocos fiéis ao padrão da banca). Isso é o principal fosso: eles prometem peça "genérica bem feita", nós entregamos peça "no padrão daquele escritório".
3. **Anti-alucinação de jurisprudência** com regra dura de só citar precedente fornecido pelo sistema.
4. **Gestão processual completa acoplada**: clientes, processos, timeline, publicações DJEN, tarefas, arquivos com OCR/embeddings.
5. **Governança de custo de IA**: log por chamada, custo por usuário/função, confirmação antes de tarefa cara, guarda de clique duplo, alta precisão opcional.
6. **Camada trabalhista específica** (mapa de 23 pedidos, cálculos, playbooks) — profundidade vertical que um produto generalista não tem no lançamento.
7. **Segurança**: RLS por organização, RPC com allowlist, políticas revisadas, sem chave de LLM no frontend.

## Onde somos piores

1. **Porta de entrada**: nosso fluxo principal é formulário/wizard multi-etapas. O deles é uma frase em chat. Percepção de esforço muito maior do nosso lado.
2. **Sem orquestrador de intenção**: o usuário precisa saber qual módulo abrir (nova petição, mapa, revisão, cálculo). Não existe "descreva e o sistema decide".
3. **Raciocínio invisível**: geramos plano por capítulos, mas o usuário não vê o sistema "pensando" — perde-se confiança percebida.
4. **Fragmentação de tela**: navegação com 8 grupos de menu contra a promessa de tela única.
5. **Sem narrativa comercial**: eles têm preço, plano, créditos e proposta de valor prontos; nós temos motor, não oferta.
6. **Revisão de documento externo** (subir peça de terceiro e revisar) é uma promessa clara deles e não é um caminho de primeira classe no nosso menu.
7. **Onboarding**: eles vendem "não precisa aprender"; nosso sistema exige cadastro de cliente/processo antes de produzir valor.

## Plano de evolução proposto

### Fase 1 — Entrada única em linguagem natural (maior ganho percebido)
Criar uma tela inicial de comando: um campo "Descreva o que você precisa". Uma chamada de classificação barata (modelo flash) interpreta a intenção e roteia para o fluxo existente já pré-preenchido — gerar peça, revisar documento, mapear pedidos, calcular, pesquisar jurisprudência, tirar dúvida. Nada de motor novo: é uma camada de roteamento sobre o que já existe.

### Fase 2 — Raciocínio visível
Exibir, durante a geração, os passos que o sistema já executa internamente (enquadramento, fundamentos, jurisprudência, riscos, montagem) como um painel de progresso com resultado parcial de cada etapa. Zero custo adicional de IA, ganho grande de confiança.

### Fase 3 — Caso sem cadastro prévio
Permitir iniciar um caso a partir de texto ou upload de documento, com cliente/processo criados depois a partir do que a IA extraiu. Remove a fricção de onboarding.

### Fase 4 — Revisão de peça externa como fluxo de primeira classe
Upload de peça pronta (própria ou da parte contrária) com saída em: riscos, lacunas, sugestões aplicáveis e comparação com o padrão do escritório. Reaproveita revisão sênior e auditoria estrutural.

### Fase 5 — Camada de estratégia
A partir do mapa de pedidos e do histórico do escritório, produzir uma nota de estratégia: teses fortes, teses arriscadas, provas faltantes, cenário de acordo. É o item "define estratégias vitoriosas" deles, e temos mais dados para fazer melhor.

### Fase 6 — Oferta comercial
Painel de créditos por organização com saldo, consumo e limite, aproveitando a telemetria de custo já existente. Habilita venda por plano/créditos sem refazer nada.

## Detalhes técnicos

- Fase 1: nova rota de comando + edge function de classificação de intenção retornando `{intent, entities, target_route, prefill}`. Reusa `selectModelForTask` em modo econômico.
- Fase 2: streaming de eventos de etapa já emitidos por `plan-draft-chapters` / `generate-draft-section`, consumidos por um componente de timeline.
- Fase 3: reuso de `ocr-extract` + `suggest-case-intake` para criar rascunho de cliente/processo pós-fato.
- Fase 4: reuso de `review-legal-draft` e `senior-legal-review` com origem "documento externo".
- Fase 5: nova função sobre `case_claim_maps` + `case_analysis`, sem novo modelo de dados relevante.
- Fase 6: view agregada sobre a tabela de log de uso de IA já existente.

## Recomendação

Priorizar Fases 1 e 2. São as duas únicas diferenças em que eles nos superam de forma estrutural, e ambas são camadas de interface sobre um motor que já é mais profundo que o prometido por eles.
