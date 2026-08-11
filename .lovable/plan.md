# Análise das duas últimas iniciais + PR-JORNADA 1

## O que li

- Raphael Augusto Koehler x Brasilsat Harald (10/08) — estabilidade acidentária, verbas rescisórias, jornada, insalubridade, dano moral/estético.
- Anderson Luis Schelbauer x JTI (06/08) — rescisão indireta, jornada com trabalho externo, integração de remuneração variável.

Estrutura, encadeamento e fidelidade ao modelo do escritório estão bons. O problema não é mais forma: é **coerência aritmética e lógica interna**, concentrada exatamente no capítulo de jornada.

## Problemas encontrados

### 1. Horas extras — erro jurídico de intervalo (Raphael, item 3.3)
A peça afirma: "A jornada aos sábados, superior a 4 horas diárias, exigiria um intervalo mínimo de 1 hora" e pede 45 minutos suprimidos. O art. 71 da CLT exige 1 hora apenas para jornada **superior a 6 horas**; entre 4 e 6 horas o mínimo é **15 minutos**. O sábado narrado é 06h00–12h00 = 6 horas exatas, com 15 minutos concedidos — ou seja, o intervalo estava **regular** e o pedido, como redigido, é improcedente e entrega um flanco à defesa.

### 2. Horas extras — jornada narrada não vira pedido quantificado (Raphael)
Segunda a sexta 07h30–17h30 com 1h13 de intervalo dá 8h47 diárias (≈47 min extras por dia), mais duas prorrogações semanais até 18h30, mais 6h de sábado — a semana passa de 49 horas. Nada disso é articulado: o capítulo pede genericamente "excedentes da 8ª e 44ª" e gasta a fundamentação no intervalo (que é o item errado). A extra real da 8ª diária, que é o núcleo do caso, fica sem narrativa própria.

### 3. Remuneração inconsistente dentro da mesma peça (Raphael)
Item 1 fixa remuneração de **R$ 3.000,00**; o item 3.2 calcula multa do art. 477 e aviso prévio sobre **R$ 3.300,00**. Duas bases diferentes no mesmo documento.

### 4. Pedido sem causa de pedir (Anderson, alínea V)
Pede adicional de **100% para feriados** sem que os fatos narrem qualquer labor em feriado.

### 5. Súmula 340 x integração da variável (Anderson)
O item 3.4 manda observar a Súmula 340 (só o adicional sobre a parte variável) e o item 5 pede a integração da média variável na base das horas extras. Sem ressalva, os dois pedidos se contradizem.

### 6. Marcadores que ainda sobrevivem
`[JURISPRUDÊNCIA A INSERIR]`, `[REVISAR ENTENDIMENTO ATUAL — Súmula Vinculante 4]`, `[CALCULAR VALOR]`, e dados do escritório em branco: `[INFORMAR VARA/COMARCA]`, `[NOME DO ADVOGADO]`, `[OAB]`, `[INFORMAR ENDEREÇO DO ESCRITÓRIO]`, `[INFORMAR ENDEREÇO DA RECLAMADA]`. Os quatro últimos não são pendência jurídica — são dados que o sistema já tem ou pode pedir uma vez.

## O que proponho: PR-JORNADA 1

Escopo enxuto, determinístico, sem nova chamada de IA.

### A. Motor de jornada (`_shared/jornada-engine.ts`)
A partir dos horários narrados no caso (entrada, saída, intervalo, dias da semana, sábados, prorrogações), calcular em código:
- horas trabalhadas por dia e por semana;
- excedente da 8ª diária e da 44ª semanal;
- intervalo **devido** pela faixa correta (até 4h: nenhum; 4h a 6h: 15 min; acima de 6h: 1h) e o efetivamente suprimido;
- regime aplicável do art. 71 conforme a data de admissão (antes/depois de 11/11/2017).

O resultado entra no prompt como fatos fechados: "sábado de 6h exatas — intervalo devido de 15 min, concedido 15 min, **não há supressão**; não formular pedido de intervalo para o sábado".

### B. Guarda de coerência fato ↔ pedido
Checagem determinística pós-geração que bloqueia/alerta quando:
- há pedido de intervalo sem supressão apurada;
- há pedido de adicional de feriado/noturno sem fato correspondente narrado;
- convivem Súmula 340 e integração da variável sem ressalva de compatibilização;
- aparece mais de uma base remuneratória distinta na peça (o caso do R$ 3.000 vs R$ 3.300).

Os achados aparecem no painel de completude como "incoerências detectadas", separados das pendências do escritório.

### C. Dados do escritório preenchidos automaticamente
Nome do advogado, OAB, endereço profissional e comarca/vara passam a vir do perfil/organização e do caso, eliminando quatro marcadores por peça. O que faltar vira pendência nomeada, não um colchete solto no texto.

### D. Tese fixa de jornada
Acrescentar à base de teses o bloco "horas extras — 8ª diária e 44ª semanal", com Súmula 264, Súmula 347, OJ 397 e reflexos em DSR (Súmula 172), para que o capítulo tenha densidade própria e não dependa do intervalo para existir.

## Detalhes técnicos

- Novo `supabase/functions/_shared/jornada-engine.ts` puro, testável, sem I/O.
- Consumido em `generate-legal-draft/index.ts`, injetado como bloco de "fatos apurados de jornada" antes do bloco do modelo.
- Guarda de coerência em `_shared/completeness.ts`, nova categoria `incoherence`, refletida em `CompletenessPanel.tsx`.
- Nova tese em `_shared/legal-theses.ts` com gatilho por menção a jornada/horas extras.
- Testes unitários cobrindo as faixas do art. 71, o caso 6h exatas, jornada 07h30–17h30 com 1h13, e as quatro regras de coerência.

## Fora de escopo

Liquidação de valores, jurisprudência automática por tese e reescrita do capítulo por IA — continuam para depois.
