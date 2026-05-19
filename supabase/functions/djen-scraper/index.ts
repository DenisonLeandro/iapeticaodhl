import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Types ──
interface PublicationConfig {
  source: "datajud" | "djen";
  datajud: { enabled: boolean };
  djen: { enabled: boolean; api_url?: string; api_key?: string; lawyer_name?: string };
}

interface ScraperResponse {
  organizations_processed: number;
  publications_found: number;
  publications_saved: number;
  errors: string[];
}

// ── DataJud constants ──
const DATAJUD_API_KEY =
  "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKVGtRZw==";

// Maps tribunal segment from CNJ number to DataJud endpoint alias
const TRIBUNAL_MAP: Record<string, string> = {
  "5.01": "trt1", "5.02": "trt2", "5.03": "trt3", "5.04": "trt4",
  "5.05": "trt5", "5.06": "trt6", "5.07": "trt7", "5.08": "trt8",
  "5.09": "trt9", "5.10": "trt10", "5.11": "trt11", "5.12": "trt12",
  "5.13": "trt13", "5.14": "trt14", "5.15": "trt15", "5.16": "trt16",
  "5.17": "trt17", "5.18": "trt18", "5.19": "trt19", "5.20": "trt20",
  "5.21": "trt21", "5.22": "trt22", "5.23": "trt23", "5.24": "trt24",
  "8.01": "tjac", "8.02": "tjal", "8.03": "tjap", "8.04": "tjam",
  "8.05": "tjba", "8.06": "tjce", "8.07": "tjdf", "8.08": "tjes",
  "8.09": "tjgo", "8.10": "tjma", "8.11": "tjmt", "8.12": "tjms",
  "8.13": "tjmg", "8.14": "tjpa", "8.15": "tjpb", "8.16": "tjpr",
  "8.17": "tjpe", "8.18": "tjpi", "8.19": "tjrj", "8.20": "tjrn",
  "8.21": "tjrs", "8.22": "tjro", "8.23": "tjrr", "8.24": "tjsc",
  "8.25": "tjse", "8.26": "tjsp", "8.27": "tjto",
  "4.01": "trf1", "4.02": "trf2", "4.03": "trf3", "4.04": "trf4",
  "4.05": "trf5", "4.06": "trf6",
  "6.01": "tre-ac", "6.02": "tre-al", "6.03": "tre-ap", "6.04": "tre-am",
  "6.05": "tre-ba", "6.06": "tre-ce", "6.07": "tre-df", "6.08": "tre-es",
  "6.09": "tre-go", "6.10": "tre-ma", "6.11": "tre-mt", "6.12": "tre-ms",
  "6.13": "tre-mg", "6.14": "tre-pa", "6.15": "tre-pb", "6.16": "tre-pr",
  "6.17": "tre-pe", "6.18": "tre-pi", "6.19": "tre-rj", "6.20": "tre-rn",
  "6.21": "tre-rs", "6.22": "tre-ro", "6.23": "tre-rr", "6.24": "tre-sc",
  "6.25": "tre-se", "6.26": "tre-sp", "6.27": "tre-to",
};

// ── Helpers ──
function extractTribunalCode(caseNumber: string): string | null {
  // CNJ format: NNNNNNN-DD.AAAA.J.TR.OOOO
  const clean = caseNumber.replace(/[^0-9.]/g, "");
  const parts = clean.split(".");
  // parts: [NNNNNNNDD, AAAA, J, TR, OOOO]
  if (parts.length >= 4) {
    const j = parts[2];
    const tr = parts[3];
    return `${j}.${tr.padStart(2, "0")}`;
  }
  return null;
}

function stripCaseNumberFormatting(cn: string): string {
  return cn.replace(/[^0-9]/g, "");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── DataJud fetcher ──
async function fetchDataJudMovements(
  caseNumber: string,
  tribunalAlias: string,
): Promise<Array<{ codigo: number; nome: string; dataHora: string; complemento?: string }>> {
  const url = `https://api-publica.datajud.cnj.jus.br/api_publica_${tribunalAlias}/_search`;
  const numero = stripCaseNumberFormatting(caseNumber);

  const body = JSON.stringify({
    query: { match: { numeroProcesso: numero } },
    size: 1,
    _source: ["movimentos", "numeroProcesso"],
  });

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `APIKey ${DATAJUD_API_KEY}`,
    },
    body,
    signal: AbortSignal.timeout(15_000),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`DataJud ${resp.status}: ${text.slice(0, 200)}`);
  }

  const json = await resp.json();
  const hits = json?.hits?.hits ?? [];
  if (hits.length === 0) return [];

  const movimentos = hits[0]?._source?.movimentos ?? [];
  // Filter movements from last 7 days
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);

  return movimentos.filter((m: { dataHora: string }) => {
    try { return new Date(m.dataHora) >= cutoff; } catch { return false; }
  });
}

// ── DJEN fetcher (custom API) ──
async function fetchDjenPublications(
  apiUrl: string,
  apiKey: string,
  lawyerName: string,
  date: string,
): Promise<Array<{ content: string; externalId: string; publicationDate: string }>> {
  const url = new URL(apiUrl);
  url.searchParams.set("advogado", lawyerName);
  url.searchParams.set("data", date);

  const resp = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(15_000),
  });

  if (!resp.ok) {
    throw new Error(`DJEN API ${resp.status}`);
  }

  const data = await resp.json();
  const items = Array.isArray(data) ? data : data?.publicacoes ?? data?.items ?? [];

  return items.map((item: Record<string, unknown>, idx: number) => ({
    content: String(item.conteudo ?? item.content ?? item.texto ?? ""),
    externalId: String(item.id ?? item.external_id ?? `djen-${date}-${idx}`),
    publicationDate: String(item.data ?? item.date ?? date),
  }));
}

// ── Main ──
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const result: ScraperResponse = {
      organizations_processed: 0,
      publications_found: 0,
      publications_saved: 0,
      errors: [],
    };

    const { data: organizations } = await supabase
      .from("organizations")
      .select("id, publication_config");

    const today = new Date().toISOString().split("T")[0];

    for (const org of organizations ?? []) {
      result.organizations_processed++;
      const cfg = (org.publication_config ?? {}) as PublicationConfig;
      const source = cfg.source ?? "datajud";

      try {
        if (source === "datajud" && cfg.datajud?.enabled !== false) {
          // ── DataJud: fetch by case number ──
          const { data: cases } = await supabase
            .from("cases")
            .select("id, case_number, assigned_to")
            .eq("organization_id", org.id)
            .eq("status", "active");

          for (const c of cases ?? []) {
            if (!c.case_number) continue;

            const tribunalCode = extractTribunalCode(c.case_number);
            if (!tribunalCode) {
              result.errors.push(`Tribunal not found for case ${c.case_number}`);
              continue;
            }

            const alias = TRIBUNAL_MAP[tribunalCode];
            if (!alias) {
              result.errors.push(`No DataJud alias for tribunal code ${tribunalCode}`);
              continue;
            }

            try {
              const movements = await fetchDataJudMovements(c.case_number, alias);
              result.publications_found += movements.length;

              // Get lawyer name for this case
              let lawyerName = "Sistema";
              if (c.assigned_to) {
                const { data: profile } = await supabase
                  .from("profiles")
                  .select("full_name")
                  .eq("id", c.assigned_to)
                  .single();
                if (profile?.full_name) lawyerName = profile.full_name;
              }

              for (const mov of movements) {
                const externalId = `datajud-${stripCaseNumberFormatting(c.case_number)}-${mov.codigo}-${mov.dataHora}`;
                const content = `${mov.nome}${mov.complemento ? ` — ${mov.complemento}` : ""}. Processo: ${c.case_number}`;
                const pubDate = mov.dataHora.split("T")[0];

                const { error: insertError } = await supabase
                  .from("publications")
                  .upsert(
                    {
                      organization_id: org.id,
                      case_id: c.id,
                      lawyer_name: lawyerName,
                      publication_date: pubDate,
                      content,
                      source: "djen",
                      external_id: externalId,
                      matched_case_number: c.case_number,
                      read: false,
                    },
                    { onConflict: "organization_id,external_id" },
                  );

                if (insertError) {
                  result.errors.push(`Insert error: ${insertError.message}`);
                } else {
                  result.publications_saved++;
                }
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              result.errors.push(`DataJud error for ${c.case_number}: ${msg}`);
            }

            // Rate limit: 1 req/s
            await sleep(1000);
          }
        } else if (source === "djen" && cfg.djen?.enabled) {
          // ── DJEN custom API ──
          const { api_url, api_key, lawyer_name } = cfg.djen;
          if (!api_url || !api_key) {
            result.errors.push(`Org ${org.id}: DJEN enabled but missing credentials`);
            continue;
          }

          const searchName = lawyer_name || "Advogado";
          try {
            const pubs = await fetchDjenPublications(api_url, api_key, searchName, today);
            result.publications_found += pubs.length;

            for (const pub of pubs) {
              const { error: insertError } = await supabase
                .from("publications")
                .upsert(
                  {
                    organization_id: org.id,
                    case_id: null,
                    lawyer_name: searchName,
                    publication_date: pub.publicationDate,
                    content: pub.content,
                    source: "djen",
                    external_id: pub.externalId,
                    matched_case_number: null,
                    read: false,
                  },
                  { onConflict: "organization_id,external_id" },
                );

              if (insertError) {
                result.errors.push(`DJEN insert: ${insertError.message}`);
              } else {
                result.publications_saved++;
              }
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            result.errors.push(`DJEN API error: ${msg}`);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Org ${org.id}: ${msg}`);
      }
    }

    console.log(
      `Scraper done: ${result.publications_found} found, ${result.publications_saved} saved, ${result.errors.length} errors`,
    );

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Scraper fatal:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
