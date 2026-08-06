# Plano — PR-COMPLETUDE (Zero Placeholder e liquidação da inicial)

A Fase 0 (fidelidade ao modelo) resolveu estrutura e estilo. O gargalo agora é **completude**: a peça sai com `[CALCULAR VALOR]`, sem valor da causa e sem pedidos que os próprios fatos exigem.

## Etapa 1 — Diagnóstico do motor de cálculo (antes de qualquer código)

O gerador já chama o motor determinístico e injeta um bloco "VALORES PRONTOS PARA USO"; quando um item não tem dados suficientes ele cai em `[CALCULAR VALOR]`. Ainda **não está confirmado** por que o caso testado caiu inteiro no pendente. Primeiro passo: inspecionar o caso gerado (dados funcionais salvos, `quality_report`, `missing_fields` de cada item pendente) e identificar se falta dado no cadastro, se a normalização não está lendo o campo, ou se é regra de confiança do motor. Só depois definir a correção exata.

## Etapa 2 — Pré-voo de completude (bloqueio antes de gastar IA)

Antes de gerar, uma checagem determinística sobre os dados do caso aponta o que falta para liquidar: salário, datas de admissão/saída, jornada, motivo da saída, verbas já pagas. O advogado vê a lista, completa em um formulário curto (ou confirma "gerar mesmo assim") e só então a geração roda. Isso elimina a maior parte dos placeholders na origem, sem custo de IA.

## Etapa 3 — Valor da causa obrigatório

Somatório automático dos pedidos com valor apurado + estimativa para os demais, com a ressalva de valores estimativos (art. 840, §1º, CLT). A peça nunca sai sem valor da causa; se não houver base, o item entra explicitamente como pendência de conferência, não como texto cru.

## Etapa 4 — Checagem cruzada fatos → pedidos

Regras determinísticas que comparam os fatos narrados com o pedido final e apontam omissões e fragilidades, por exemplo:
- jornada declarada excede a legal e não há pedido de horas extras / intervalo;
- trabalho noturno, domingos ou insalubridade descritos e não pleiteados;
- multa do art. 467 pedida em caso de vínculo controvertido;
- dano moral apoiado apenas em ausência de registro (tese frágil no TST);
- honorários, tributos e responsabilização de sócios ausentes.

Cada achado vira um aviso no relatório de qualidade da minuta, com sugestão de correção — sem reescrever automaticamente.

## Etapa 5 — Auditoria "Zero Placeholder" no fecho

Ao final da geração, varredura por marcadores (`[CALCULAR VALOR]`, `[INFORMAR ...]`, `[REVISAR ...]`) com contagem e localização por seção. A tela do documento mostra um selo de completude (ex.: "3 pendências") com atalho para cada trecho, para o advogado resolver em minutos em vez de reler tudo.

## Detalhes técnicos

- `_shared/calc-engine.ts` e `_shared/calc-engine/normalize-context.ts`: investigar `missing_fields` e a origem dos dados funcionais; ajustar mapeamento apenas onde o diagnóstico apontar.
- Novo `_shared/completeness.ts`: pré-voo (dados mínimos), checagem fatos→pedidos e varredura de placeholders, reaproveitado por `generate-legal-draft` e `generate-draft-section`.
- Valor da causa calculado no mesmo módulo e injetado no bloco de valores prontos, com regra de prompt obrigando o item final.
- Resultados gravados em `quality_report` (`completeness_audit`) e exibidos na página do documento.
- Sem novas chamadas de IA: todas as verificações são determinísticas, custo zero.

## Ordem sugerida

Etapa 1 (diagnóstico) → Etapas 3 e 5 (valor da causa + auditoria, ganho imediato) → Etapa 2 (pré-voo) → Etapa 4 (checagem cruzada).
