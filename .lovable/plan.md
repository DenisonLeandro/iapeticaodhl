# Comparativo Harvey (global, produto real) x nosso sistema + plano de evolução

## Esclarecimento sobre os dois "Harvey"

São produtos diferentes:

1. **Harvey (harvey.ai)** — produto global real, fundado em 2022 (Winston Weinberg, ex-litigator, + Gabe Pereyra, ex-Google/Meta), modelos customizados sobre OpenAI, +200 mil profissionais, foco em Am Law 100, Big Four e departamentos jurídicos Fortune 500. É este que serve de referência de funcionamento real.
2. **harveyai.com.br** — projeto brasileiro independente, ainda em pré-lançamento (lista de espera por WhatsApp), com planos de R$ 359,90 / R$ 659,90 / sob consulta. Não há produto acessível; só promessa de posicionamento.

A comparação abaixo usa o **Harvey global** como referência técnica, e o `.com.br` apenas como referência de posicionamento comercial no Brasil.

## Como o Harvey global realmente funciona

Cinco ferramentas centrais, mais camadas recentes:

- **Assistant** — tela única de chat onde o usuário pergunta, anexa documentos e escolhe *fontes de conhecimento* (LexisNexis, EUR-Lex, EDGAR, web, Vault). Gera, edita, resume e redige. Toda resposta é ancorada na fonte exata usada.
- **Vault** — repositório de milhares de documentos com análise em massa: Review Tables (extração para tabela estruturada), Q&A dirigido, sumarização em lote, agentes de um clique por área (M&A, litigation).
- **Workflow Agents** — automações reutilizáveis: conjuntos de consultas e etapas que o escritório monta uma vez e roda sempre. Executam trabalho ponta a ponta.
- **Knowledge** — pesquisa jurídica, regulatória e tributária multi-jurisdição sobre bases licenciadas.
- **History / Library** — histórico de threads e biblioteca de prompts/modelos do escritório.
- **Camadas 2025-2026** — Shared Spaces (colaboração entre organizações), Command Center (analytics, benchmarking e adoção de IA no escritório), Contract Intelligence, Harvey Mobile, Ecosystem (add-in de Word e integrações onde o time já trabalha), Harvey Academy (treinamento).

Pontos de arquitetura relevantes: fine-tuning sobre acervo jurídico, grounding obrigatório com citação da fonte exata, geração a partir de templates aprovados do próprio escritório, matriz de risco e verificação de conformidade contra padrões internos, e busca global (Cmd+K) como espinha dorsal da navegação.

Críticas recorrentes na imprensa especializada: preço e contrato enterprise, obrigatoriedade de sales call, saída em formato de memorando longo (padrão Big Law), pouca aderência a rotinas de departamento jurídico enxuto, e nenhuma cobertura de foro brasileiro.

## Onde estamos iguais

| Capacidade | Harvey global | Nós |
|---|---|---|
| Redação a partir de modelos do escritório | sim (Library) | sim, e com extração de trechos literais + style guide |
| Grounding com fonte | sim, citação exata | sim, para jurisprudência e documentos do processo |
| Análise de documentos em volume | Vault | pipeline OCR + chunk + embeddings + chat do processo |
| Chat com o acervo | Assistant | chat do processo e chat do documento |
| Análise de risco | risk matrix / compliance | Mapa de Pedidos e Riscos + revisão sênior |
| Revisão contra padrão interno | sim | sim, playbooks + auditoria estrutural |
| Analytics de uso de IA | Command Center | tela de consumo `/settings/ai-usage` |
| Multiusuário e segurança | enterprise | multi-tenant com RLS por organização |

## Onde somos melhores

1. **Foro brasileiro nativo** — DJEN, tribunais brasileiros, CPC/CLT, padrão CNJ/ABNT, cálculo trabalhista. O Harvey não cobre isso.
2. **Vertical trabalhista profunda** — mapa canônico de pedidos, pares principal/sucessivo, guardas de tese sensível, cálculos vinculados. Harvey é generalista corporativo.
3. **Fidelidade ao padrão da banca** — não só "usar template", mas reproduzir numeração, blocos e estilo do modelo real do escritório.
4. **Gestão processual acoplada** — clientes, processos, timeline, publicações, tarefas. O Harvey é ferramenta de trabalho, não sistema de escritório.
5. **Governança de custo por chamada** — log, custo por usuário/função, modo econômico, confirmação antes de tarefa cara. Harvey esconde isso em contrato enterprise.
6. **Acessível a escritório pequeno e médio** — sem sales call, sem contrato mínimo.

## Onde somos piores

1. **Porta de entrada** — o Assistant do Harvey é uma tela só: pergunta, anexo, fonte, resposta. O nosso fluxo principal é wizard multi-etapas com cadastro prévio.
2. **Sem agentes/workflows reutilizáveis** — o escritório não consegue montar e salvar uma automação própria ("checklist de inicial trabalhista", "análise de contestação") sem código nosso.
3. **Sem grounding com citação exata na maioria das saídas** — citamos jurisprudência com guarda, mas não devolvemos "esta frase veio da página X do documento Y" de forma sistemática.
4. **Sem análise em massa tipo Review Table** — não há extração multi-documento para tabela comparativa.
5. **Sem busca global** — não existe Cmd+K sobre processos, minutas, documentos e threads.
6. **Sem integração onde o advogado já trabalha** — nada de add-in de Word, e-mail ou mobile.
7. **Sem base de pesquisa jurídica licenciada** — dependemos de scraping de tribunais, não de acervo estruturado.
8. **Sem biblioteca de prompts/histórico reaproveitável** pelo usuário final.

## Plano de evolução proposto

### Fase 1 — Assistant único (entrada em linguagem natural)
Uma tela de comando: campo de texto, anexo opcional e seletor de fonte (este processo / meus documentos / jurisprudência / modelos do escritório). Uma classificação barata de intenção roteia para os fluxos que já existem, pré-preenchidos. É a diferença de percepção mais forte entre nós e o Harvey.

### Fase 2 — Busca global (Cmd+K)
Busca unificada sobre processos, clientes, minutas, documentos e conversas. Barato de fazer, impacto alto em sensação de produto maduro.

### Fase 3 — Grounding com citação exata
Toda afirmação da IA sobre um documento do processo devolve trecho e localização clicável, usando os chunks e embeddings que já existem.

### Fase 4 — Workflow Agents do escritório
Permitir que o admin monte e salve sequências reutilizáveis (etapas, prompts, modelo, playbook, saída esperada) e que qualquer advogado rode com um clique. Generaliza os fluxos hoje fixos em código.

### Fase 5 — Análise em massa (Review Table)
Selecionar N documentos de um processo ou cliente e extrair colunas definidas pelo usuário para uma tabela comparativa exportável.

### Fase 6 — Raciocínio visível e biblioteca
Mostrar as etapas de raciocínio durante a geração e manter histórico/biblioteca de prompts e peças reaproveitáveis por organização.

### Fase 7 — Onde o advogado trabalha
Export/edição em Word com ida e volta, e visão mobile de leitura e aprovação.

## Detalhes técnicos

- Fase 1: rota nova + edge function de classificação de intenção devolvendo `{intent, entities, target_route, prefill}`, usando `selectModelForTask` em modo econômico.
- Fase 2: busca no Postgres com `pg_trgm` sobre as tabelas principais, sem custo de IA.
- Fase 3: reaproveita `document_chunks` e embeddings já persistidos; exige apenas retornar `chunk_id` nas respostas e renderizar o trecho.
- Fase 4: novas tabelas `workflow_agents` e `workflow_runs` com RLS por organização; execução reusa as edge functions existentes como passos.
- Fase 5: nova função de extração em lote sobre chunks, com schema de colunas definido pelo usuário e saída em XLSX (já temos exportador).
- Fase 6: streaming dos eventos que `plan-draft-chapters` e `generate-draft-section` já emitem.
- Fase 7: `src/lib/docx/export-document.ts` já existe; falta o caminho de reimportação.

## Recomendação

Priorizar Fases 1, 2 e 3. São as três lacunas em que o Harvey é estruturalmente superior e que não exigem base de dados licenciada nem contrato enterprise. As Fases 4 e 5 são o que transforma o sistema de "gerador de peças" em plataforma de escritório.
