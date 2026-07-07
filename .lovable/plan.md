## PR-6A.1 — Revalidação final (execução apenas)

Sem alteração de código, prompt, migration, frontend ou fluxos. Edge function `build-claim-map` já deployada com a versão final (incluindo `\brt\b` no detector trabalhista).

### Passos

1. **Snapshot pré-execução** — `SELECT id, updated_at FROM case_drafts WHERE case_id IN (...)` para os 3 casos, para comparar depois e confirmar intocado.
2. **Executar `build-claim-map` via `supabase--curl_edge_functions`** com `force_regenerate:true` para:
   - `9c035db9-faf4-40b4-9339-c0341c075e5f` (contexto pobre, subject "RT")
   - `74158d88-4733-4935-83c5-1f023a99141e` (contexto insuficiente)
   - `9ca0912f-ca64-4a56-a4f4-0e5d1c64db4a` (Elvis, baseline rico)
   - Se `curl_edge_functions` estourar timeout do wrapper, aguardar e conferir persistência via `read_query` (a função continua rodando no backend mesmo após o wrapper desistir).
3. **Snapshot pós-execução** por caso:
   - `version`, `is_current`, `jsonb_array_length(claims)`, `cost_estimate`, `tokens_input/output`, `missing_case_data`, `global_warnings`, `metadata->>'used_fallback'`.
   - Contagem `applicable`/`uncertain`/`not_applicable`.
   - Contagem `risk_level` high+critical.
   - Contagem `requires_lawyer_confirmation=true`.
   - Para Elvis: extrair claim `ferias_em_dobro` e checar `risk_level`, `recommended_action`, `requires_lawyer_confirmation`, warning ADPF 501; presença de `rescisao_indireta`, `horas_extras`, `intervalo_intrajornada`, `intervalo_interjornada`, `fgts_irregular`, `integracao_verbas_variaveis`.
   - Presença única de `is_current=true` (`SELECT count(*) FILTER (WHERE is_current) GROUP BY case_id`).
4. **Snapshot final `case_drafts`** — comparar com o snapshot inicial: `updated_at` inalterado.
5. **Typecheck** — `bunx tsgo --noEmit`.

### Relatório final (por caso)

Tabela com: `version`, `n_claims`, applicable/uncertain/not_applicable, high+critical, requires_lawyer_confirmation, `n_missing_case_data`, `cost_estimate`, ADPF 501 (apenas Elvis), `is_current` único, `case_drafts` intacto, typecheck.
