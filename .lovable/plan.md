# Plano — Fidelidade ao modelo do escritório (prioridade)

Objetivo: a petição gerada deve reproduzir fielmente a estrutura, numeração, linguagem, blocos e forma de pedir do modelo que o advogado anexa. Hoje não reproduz.

## Diagnóstico (causa raiz verificada no código)

O advogado anexa um arquivo (Word/PDF). O sistema extrai o texto completo — até 120.000 caracteres — e guarda na coluna `extracted_text` da tabela `legal_templates` (`analyze-legal-template/index.ts:23,467`). **O texto completo existe no banco.**

Mas na hora de gerar a petição, `generate-legal-draft` não envia o texto completo à IA. Ele envia:

1. **Resumos gerados pela IA** — `structure_summary`, `style_summary`, `standard_sections`, `topic_structure`, `writing_patterns`, `request_patterns` (`generate-legal-draft/index.ts:548-560`). São paráfrases, não o texto literal.
2. **Apenas 3 fragmentos curtos do texto real**, totalizando no máximo **6.000 caracteres** (`template-excerpt.ts:23-25`: abertura 1.500, estilo 2.000, pedidos 2.500).

Uma petição inicial trabalhista real tem 15.000–30.000 caracteres. A IA recebe 6.000 caracteres fragmentados e resumos. **Ela nunca vê o modelo inteiro, então não consegue espelhar sua estrutura, transições, linguagem e forma de pedir ao longo de toda a peça.** O teto de 6.000 caracteres foi criado no PR-Q1A explicitamente para economizar tokens (`template-excerpt.ts:2-4`).

Esta é a causa raiz. Não é bug de extração, não é bug de prompt — é um limite artificial de custo que corta exatamente o que faria a fidelidade.

## O que vamos mudar

### Fase 0 — Enviar o modelo completo à IA (núcleo da fidelidade)

Substituir a seleção de 3 fragmentos (6.000 chars) pelo envio do texto literal do modelo — completo ou com teto alto (ex.: 60.000 chars, o mesmo limite que o `analyze-legal-template` já usa para análise). O texto completo já está no banco; basta enviá-lo.

- Em `generate-legal-draft`, injetar `extracted_text` (truncado a um teto generoso) como **texto literal dominante** no prompt, substituindo o bloco `templateExcerptPromptBlock`.
- Reforçar a instrução de fidelidade: "espelhe a ordem das seções, a numeração, os blocos e a linguagem do modelo abaixo; troque apenas os fatos/partes/valores pelos do caso atual".
- Manter a proibição de copiar fatos/nomes/valores do modelo (já existe e está correta).
- Aplicar também no modo rápido e, quando habilitado, no modo por capítulos.

**Por que isto resolve:** a IA passa a ver o modelo inteiro e pode reproduzir sua arquitetura de ponta a ponta, em vez de adivinhar a partir de 3 recortes.

### Fase 1 — Esqueleto estrutural extraído do modelo

Extrair deterministicamente (sem IA) a lista de seções/capítulos do modelo na ordem em que aparecem — usando os títulos em MAIÚSCULAS e a numeração detectada — e injetar como "esqueleto obrigatório" no prompt. A IA deve seguir a ordem e os títulos do modelo, preenchendo cada seção com os fatos do caso atual.

- Reaproveitar `detectsArabicNumbering` e a detecção de títulos em MAIÚSCULAS já existentes.
- Para modelo trabalhista, harmonizar com o esqueleto canônico já existente (`trabalhista-inicial.ts`): quando o modelo divergir do canônico, o modelo prevalece (é a vontade do escritório).

### Fase 2 — Auditoria de fidelidade

Estender a auditoria leve existente (`runLightDraftAudit`) para comparar a minuta gerada **contra o próprio modelo**, não apenas contra padrões genéricos:

- A minuta contém as mesmas seções na mesma ordem?
- A numeração bate com o modelo?
- Os blocos presentes no modelo (ex.: DADOS FUNCIONAIS) aparecem na minuta?
- A forma de pedir (itens numerados vs. parágrafos) espelha o modelo?
- Razão entre tamanho da minuta e tamanho do modelo dentro de uma faixa aceitável.

Resultado vira `quality_report.fidelity_audit` e warnings acionáveis para o advogado.

## Detalhes técnicos

- `template-excerpt.ts`: adicionar `buildFullTemplateBlock(extractedText, maxChars=60000)` que devolve o texto literal truncado + metadados de numeração/blocos. Manter `buildTemplateExcerpt` para compatibilidade/auditoria, mas o prompt passa a usar o bloco completo.
- `generate-legal-draft/index.ts`: substituir `templateExcerptPromptBlock` (linhas 609–622) pelo bloco completo; ajustar `DRAFT_SYSTEM` para instrução de espelhamento; injetar esqueleto extraído.
- `style-guide.ts`: mantém-se, mas deixa de ser a principal fonte de fidelidade — o texto literal passa a ser.
- Custo: o aumento de input tokens é o trade-off. Enviar ~60.000 chars (~15k tokens) em vez de 6.000 (~1,5k tokens) por geração. No `gemini-2.5-pro` o acréscimo é da ordem de US$ 0,02–0,04 por geração. Em modo econômico (`gemini-2.5-flash`), menos. Justificável: é exatamente o recurso que o advogado mais valoriza.
- Sem migração de banco: `extracted_text` já existe e já é populado. Modelos antigos sem `extracted_text` caem no caminho atual (fragmentos) como fallback.

## Esforço estimado

| Fase | Estimativa |
|---|---|
| 0 — Modelo completo no prompt | 6–10h |
| 1 — Esqueleto estrutural | 6–10h |
| 2 — Auditoria de fidelidade | 6–10h |
| **Total** | **18–30h** |

Cada fase é entregável e testável isoladamente. A Fase 0 sozinha já deve produzir a diferença mais perceptível.

## Validação

1. Pegar uma petição modelo real do escritório (anexada, já no banco).
2. Gerar a mesma peça antes e depois da Fase 0, com o mesmo caso.
3. Comparar lado a lado: ordem das seções, numeração, presença dos blocos, forma de pedir, densidade.
4. Validar com o advogado: "esta minuta se parece com a sua?" antes/depois.

## Fora de escopo (adiado)

As Fases de UX (busca global, grounding, wizard, Assistant) ficam congeladas até a fidelidade estar validada em caso real. Reavaliar após o advogado confirmar que a peça gerada reproduz fielmente o modelo.
