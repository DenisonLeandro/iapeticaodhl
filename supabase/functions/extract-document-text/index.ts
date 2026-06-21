// Extração de texto streaming, página a página.
// PDFs nativos: pdfjs-dist com range requests (não carrega o PDF inteiro em RAM
// — só os bytes necessários para o catálogo e a página corrente).
// Não-PDFs: tenta texto direto; caso contrário marca para OCR futuro.
//
// Interno — aceita apenas service_role.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, json } from "../_shared/cors.ts";
import { requireServiceRole, serviceClient } from "../_shared/auth.ts";
import { EXTRACTION_MODEL_PDFJS, EXTRACTION_VERSION } from "../_shared/versions.ts";

// pdf.js legacy build — funciona no Deno sem worker.
// @ts-ignore — sem types
import * as pdfjsLib from "npm:pdfjs-dist@4.0.379/legacy/build/pdf.mjs";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function signedUrl(storagePath: string): Promise<string> {
  const svc = serviceClient();
  const { data, error } = await svc.storage
    .from("client-documents")
    .createSignedUrl(storagePath, 600);
  if (error || !data?.signedUrl) throw new Error(`signedUrl: ${error?.message ?? "no url"}`);
  return data.signedUrl;
}

async function extractPdfStreaming(
  url: string,
  onPage: (pageNum: number, text: string) => Promise<void>,
): Promise<number> {
  // disableAutoFetch + disableStream:false => pdfjs usa Range requests sob demanda.
  const loadingTask = pdfjsLib.getDocument({
    url,
    disableAutoFetch: true,
    disableStream: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });
  const pdf = await loadingTask.promise;
  const n = pdf.numPages;
  for (let i = 1; i <= n; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    const text = tc.items.map((it: { str?: string }) => it.str ?? "").join(" ");
    await onPage(i, text.replace(/\s+/g, " ").trim());
    // Libera memória da página antes de carregar a próxima.
    page.cleanup();
  }
  await pdf.cleanup();
  await pdf.destroy();
  return n;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!requireServiceRole(req)) return json({ error: "Forbidden" }, 403);

  let body: { file_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (!body.file_id) return json({ error: "file_id required" }, 400);

  const svc = serviceClient();
  const { data: file, error: fErr } = await svc
    .from("client_files")
    .select("id, organization_id, storage_path, file_type, file_size")
    .eq("id", body.file_id)
    .maybeSingle();
  if (fErr || !file) return json({ error: "file not found" }, 404);

  await svc
    .from("client_files")
    .update({ pipeline_stage: "extracting", pipeline_last_error: null })
    .eq("id", file.id);

  try {
    const isPdf =
      (file.file_type ?? "").toLowerCase().includes("pdf") ||
      (file.storage_path ?? "").toLowerCase().endsWith(".pdf");

    const pages: { page: number; text: string }[] = [];

    if (isPdf) {
      const url = await signedUrl(file.storage_path);
      // Página-a-página: mantemos só a página corrente em memória.
      const totalPages = await extractPdfStreaming(url, async (pageNum, text) => {
        pages.push({ page: pageNum, text });
      });

      // Persiste texto agregado (preservando marcação de página para chunking).
      const aggregated = pages.map((p) => `\n\n[[PAGE ${p.page}]]\n${p.text}`).join("");

      await svc
        .from("client_files")
        .update({
          extracted_text: aggregated,
          page_count: totalPages,
          extraction_version: EXTRACTION_VERSION,
          extraction_model: EXTRACTION_MODEL_PDFJS,
          extraction_at: new Date().toISOString(),
          pipeline_stage: "extracting",
        })
        .eq("id", file.id);

      return json({ ok: true, pages: totalPages, chars: aggregated.length });
    }

    // Não-PDF: tenta como texto puro (txt/md/json) via download direto.
    const { data: blob, error: dErr } = await svc.storage
      .from("client-documents")
      .download(file.storage_path);
    if (dErr || !blob) throw new Error(`download: ${dErr?.message ?? "no blob"}`);
    const text = await blob.text();
    await svc
      .from("client_files")
      .update({
        extracted_text: text,
        page_count: 1,
        extraction_version: EXTRACTION_VERSION,
        extraction_model: "text-passthrough@v1",
        extraction_at: new Date().toISOString(),
      })
      .eq("id", file.id);
    return json({ ok: true, pages: 1, chars: text.length });
  } catch (e) {
    const msg = (e as Error).message;
    await svc
      .from("client_files")
      .update({ pipeline_stage: "failed", pipeline_last_error: `extract: ${msg}` })
      .eq("id", file.id);
    return json({ error: msg }, 500);
  }
});
