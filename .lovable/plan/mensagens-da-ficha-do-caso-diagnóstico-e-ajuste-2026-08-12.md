# Mensagens da Ficha do Caso: diagnóstico e ajuste

## O que está acontecendo

Nenhuma das duas mensagens da tela é erro — as duas são avisos informativos, mas escritos de forma técnica e alarmante.

1. "Atenção: amount_involved, facts_period extraído(s) de documentos por heurística — revise antes de salvar."
   Aparece após a importação de dados dos documentos do caso. Ela apenas informa que dois campos foram deduzidos por leitura automática (regex) e não vieram de uma ficha anterior confirmada. O problema é que a mensagem mostra o nome técnico da coluna do banco, em vermelho/amarelo, o que parece falha do sistema.

2. "Ficha parcial" (em vermelho)
   É o selo de status da ficha. Ele fica "parcial" enquanto qualquer um destes campos estiver vazio: área jurídica, parte representada, resumo do problema, relato do cliente, objetivo do cliente, urgência, documentos existentes. Não bloqueia salvar nem gerar análise — só sinaliza que a análise sairá menos completa. Hoje ele não diz *o que* falta, e a cor sugere erro.

## Solução proposta (apenas apresentação, sem mudar regra de negócio)

1. Rótulos legíveis nos avisos de importação
   Mapear os nomes técnicos para rótulos em português ("Valor envolvido", "Período dos fatos", etc.) e reescrever o texto como aviso neutro: "2 campos foram preenchidos automaticamente a partir dos documentos: Valor envolvido, Período dos fatos. Confira antes de salvar." Mesmo tratamento no aviso de relato/resumo.

2. Marcar o campo em vez de gritar no toast
   Nos campos preenchidos por heurística, exibir uma pequena etiqueta "preenchido automaticamente — conferir" abaixo do input, que some quando o usuário edita o campo. Assim o advogado sabe exatamente onde olhar.

3. Selo de status mais claro
   Trocar a cor vermelha por âmbar (aviso, não erro) e acrescentar tooltip/lista com os campos que faltam para a ficha ficar completa, com o texto: "Ficha parcial — falta: Urgência, Documentos existentes. Você pode salvar mesmo assim."

## Detalhes técnicos

- `src/types/caseIntake.ts`: adicionar `INTAKE_FIELD_LABEL` (mapa campo → rótulo em PT) e fazer `computeIntakeStatus` retornar também a lista de campos faltantes (nova função auxiliar `missingIntakeFields`, mantendo a assinatura atual para não quebrar chamadas).
- `src/components/cases/CaseIntakeForm.tsx`: usar os rótulos nos toasts de `applyPrefillValues`; guardar `heuristicFields` aplicados em estado para renderizar a etiqueta por campo e limpá-la ao editar; ajustar a cor e o tooltip do selo de status.
- Sem alteração de backend, de banco ou da lógica de importação em `src/services/caseIntakePrefill.ts`.
