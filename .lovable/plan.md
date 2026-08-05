# Plano de evolução — escopo enxuto (Fases 2, 3, 6 e 1)

Escopo aprovado: ~70–105 horas, entregue **uma fase por vez**, com validação de advogado real antes de seguir.

Ordem ajustada ao gargalo relatado (wizard > navegação > revisão): o wizard é atacado em duas etapas — primeiro por redução de atrito (barato, cedo), depois pelo Assistant completo. Isso evita o risco de o Assistant virar mais uma camada antes do mesmo wizard.

## Ordem de execução

| # | Fase | Estimativa | Ganho |
|---|---|---|---|
| A | Enxugar o wizard (pré-Assistant) | 10–16h | Ataca o gargalo nº1 já na primeira entrega |
| B | Busca global (Cmd+K) | 8–14h | Ataca o gargalo nº2, sem custo de IA |
| C | Grounding com citação exata | 20–30h | Ataca o gargalo nº3, gera confiança na saída |
| D | Raciocínio visível durante a geração | 8–12h | Reduz sensação de espera |
| E | Assistant único (entrada em linguagem natural) | 30–45h | Só depois de A–D provarem o caminho |

Total: 76–117h. Cada fase termina em uma entrega utilizável e testável isoladamente.

---

## Fase A — Enxugar o wizard

Antes de substituir o wizard por chat, remover o que ele pede sem necessidade.

- Auditar cada campo obrigatório das etapas atuais e classificar em: essencial, derivável de dados já cadastrados, ou opcional.
- Pré-preencher tudo que já existe no cliente/processo selecionado.
- Colapsar etapas que hoje têm poucos campos em uma só tela.
- Permitir "gerar agora" com os campos essenciais e completar o resto depois.

Critério de validação: contar cliques e campos digitados para gerar uma inicial trabalhista antes e depois. Meta: redução de pelo menos 40%.

## Fase B — Busca global (Cmd+K)

Paleta de comando acessível de qualquer tela, buscando processos, clientes, minutas, documentos e tarefas.

- Busca no Postgres com `pg_trgm`, sem chamada de IA.
- Resultados agrupados por tipo, navegação por teclado, atalho `Cmd/Ctrl+K`.
- Escopo por organização via RLS já existente.

Critério de validação: advogado encontra um processo pelo nome parcial da parte em menos de 5 segundos.

## Fase C — Grounding com citação exata

Toda afirmação da IA sobre documento do processo devolve trecho e localização clicável.

- Respostas do chat do processo e do documento passam a retornar `chunk_id` junto do texto.
- UI renderiza a citação como chip clicável que abre o trecho de origem destacado.
- Aplicar também às seções geradas que citem documento do processo.

Critério de validação: advogado consegue conferir a origem de uma afirmação sem abrir o PDF inteiro.

## Fase D — Raciocínio visível

Exibir as etapas reais da geração (planejamento de capítulos, seção em curso, auditoria) usando os eventos que as edge functions já emitem — sem chamadas de IA adicionais.

Critério de validação: durante a geração, o usuário sempre sabe em que etapa está.

## Fase E — Assistant único

Só iniciar após A–D validados, e apenas se a Fase A não tiver resolvido o atrito do wizard.

- Tela única: campo de texto, anexo opcional, seletor de fonte (este processo / meus documentos / jurisprudência / modelos do escritório).
- Classificação barata de intenção roteia para o fluxo correto **já preenchido**, não para o wizard vazio.
- Regra de projeto: o Assistant precisa *substituir* etapas. Se ao final ele apenas antecede o wizard, a fase é descartada.

Critério de validação: gerar uma inicial trabalhista partindo só de um parágrafo em linguagem natural + processo selecionado.

---

## Detalhes técnicos

- Fase A: apenas frontend (`DraftGeneratorPage` e etapas do wizard) + leitura de dados já persistidos. Sem migração.
- Fase B: índices `pg_trgm` nas tabelas principais; uma RPC de busca unificada com `SECURITY DEFINER` e filtro por `get_my_organization_id()`; componente de command palette no shell.
- Fase C: reaproveita `document_chunks` e embeddings existentes; alterações nas edge functions `case-chat` e afins para propagar `chunk_id`; novo componente de citação.
- Fase D: streaming/persistência dos eventos que `plan-draft-chapters` e `generate-draft-section` já produzem.
- Fase E: rota nova + edge function de classificação de intenção retornando `{intent, entities, target_route, prefill}`, usando `selectModelForTask` em modo econômico.

## Fora de escopo agora

Workflow Agents, Review Table multi-documento, add-in de Word e mobile. Reavaliar só depois de A–D em uso real.

## Referência: comparativo Harvey

O comparativo detalhado com o Harvey global que originou este plano permanece válido como diagnóstico. Conclusão estratégica: nossas vantagens (foro brasileiro, vertical trabalhista, fidelidade ao padrão da banca, gestão processual acoplada, governança de custo) não devem ser diluídas em busca de paridade de UX com um produto generalista corporativo que não atua no nosso nicho. Copiamos apenas o que é objetivamente melhor: entrada única, busca global e grounding citável.
