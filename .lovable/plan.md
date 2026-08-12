# Caso Leandro Morais: ficha não preencheu e análise travou

## O que os dados mostram

Verifiquei o caso `1de8ed70…` (Leandro Morais Domingos) no banco.

**1. Os documentos foram marcados como "Processado", mas estão vazios.**

| Arquivo | Texto extraído | Blocos |
|---|---|---|
| FICHA CLIENTE LEANDRO MORAIS.pdf | 26 caracteres | 1 |
| 1.2 DECLARAÇÃO.pdf | 13 caracteres | 1 |
| 1.3 DOCUMENTO DE IDENTIFICAÇÃO.pdf | 13 caracteres | 1 |
| 1.4 CTPS Contratos Digitais.pdf | 4.123 caracteres | 4 |
| 1.5 CRACHÁ.pdf | 13 caracteres | 1 |
| 1.6 COMPROVANTES DE PAGAMENTO.pdf | 39 caracteres | 1 |

O conteúdo salvo desses arquivos é literalmente `[[PAGE 1]]`, `[[PAGE 2]]`. São PDFs digitalizados (imagem), sem camada de texto. A extração tenta primeiro o leitor de PDF e só aciona a leitura por IA (OCR) quando o leitor **falha com erro**. Em PDF escaneado o leitor não falha: devolve zero texto e o pipeline conclui como "Processado" com o arquivo vazio.

Consequência direta: a Ficha Inteligente não tinha de onde importar — o botão de importar só encontra a CTPS. Por isso ela não completou automaticamente e o relato precisou ser colado à mão.

**2. A análise com IA não chegou a existir.**

Não há nenhuma linha em `case_analyses` para este caso — nem `running`, nem `failed`. A função de análise cria a linha `running` logo no início; como ela não existe, a chamada não chegou lá. E o botão fica girando indefinidamente porque:

- a chamada é disparada sem `await` e sem tempo limite;
- o guarda de execução em memória (`inflight-guard`) mantém a promessa presa, então cliques seguintes não fazem nada;
- não existe nenhuma mensagem de erro nesse caminho — o usuário só vê o botão travado. ("Caso em preparação" é apenas o rótulo do cabeçalho, não um erro.)

A causa exata da falha da chamada ainda não está confirmada — não há registro de log dessa execução. Por isso o primeiro passo do plano é instrumentar e reproduzir, não adivinhar.

## O que fazer

### Etapa 1 — Destravar a análise (correção de UX, certa em qualquer cenário)

- Aguardar a chamada de análise com tempo limite explícito (ex.: 120s) e liberar o guarda em memória ao terminar ou estourar o tempo.
- Em falha ou tempo esgotado: mensagem clara ("Não foi possível iniciar a análise — tente novamente") e botão volta a ficar clicável.
- Registrar no console o erro real da invocação para diagnóstico.
- Reproduzir o clique com a instrumentação ativa e confirmar no banco se a linha `running` passa a ser criada; se a falha for do lado da função, corrigir na sequência com o erro em mãos.

### Etapa 2 — Fazer o OCR acontecer em PDF digitalizado (causa raiz da ficha vazia)

- Na extração, avaliar o **rendimento** do leitor de PDF: se o texto útil (descontando marcadores `[[PAGE n]]`) ficar abaixo de um mínimo por página, tratar como falha e acionar a leitura por IA, como já acontece hoje quando o leitor gera exceção.
- Só marcar o arquivo como "Processado" se houver texto útil; caso contrário, marcar como pendente de OCR com motivo visível na lista de arquivos.
- Reprocessar os 5 arquivos deste caso e conferir se a ficha passa a importar parte contrária, período, valores e relato.

### Etapa 3 — Sinalizar arquivo sem texto na interface

- Na lista de documentos do caso, indicar "sem texto reconhecido" quando o arquivo concluir sem conteúdo útil, para o advogado não confiar em um "Processado" enganoso.

## Detalhes técnicos

- `supabase/functions/extract-document-text/index.ts`: fallback multimodal hoje só dispara em `catch`; incluir checagem de rendimento (`chars úteis / páginas`) após o caminho pdfjs.
- `src/services/caseAnalysis.ts` e `src/hooks/useCaseAnalysis.ts`: `runCaseAnalysis` com `AbortController`/timeout; `withInflight` liberando a chave em erro; `generate` passa a ser aguardado.
- `src/components/cases/CaseIntakeForm.tsx`: `handleSaveAndAnalyze` com `await` e toast de erro real.
- `src/components/files/PipelineStageBadge.tsx` + lista de arquivos: estado visual para "concluído sem texto".

Sem novas tabelas, sem nova chamada de IA além do OCR que já existe e hoje deixa de ser acionado.
