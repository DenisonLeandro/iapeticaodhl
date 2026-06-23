// Extração de texto.
// PDFs pequenos com texto nativo: pdfjs-dist (streaming página-a-página).
// PDFs grandes (> LARGE_PDF_THRESHOLD) OU falha de pdfjs (parse/CPU/recurso):
//   fallback para Gemini multimodal via Lovable AI Gateway.
// Não-PDFs: tenta texto direto; caso contrário marca para OCR futuro.
//
// Interno — aceita apenas service_role.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";
import { corsHeaders, json } from "../_shared/cors.ts";
import { requireServiceRole, serviceClient } from "../_shared/auth.ts";
import {
  EXTRACTION_MODEL_PDFJS,
  EXTRACTION_VERSION,
} from "../_shared/versions.ts";

// pdf.js legacy build — funciona no Deno sem worker.
// @ts-ignore — sem types
import * as pdfjsLib from "npm:pdfjs-dist@4.0.379/legacy/build/pdf.mjs";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

// Acima desse tamanho, vai direto para fallback (pdfjs estoura CPU no edge).
const LARGE_PDF_THRESHOLD = 8 * 1024 * 1024; // 8 MB

// Acima desse limite hard o próprio fallback multimodal não cabe no orçamento
// de CPU/memória do edge runtime (encode base64 + upload de >15 MB excede o
// CPU time budget). Falhamos limpo com mensagem clara para o usuário.
const HARD_MAX_PDF_BYTES = 15 * 1024 * 1024; // 15 MB

const EXTRACTION_MODEL_MULTIMODAL = "gemini-2.5-flash@multimodal";
const EXTRACTION_VERSION_MULTIMODAL = "v1-multimodal";

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
    page.cleanup();
  }
  await pdf.cleanup();
  await pdf.destroy();
  return n;
}

/**
 * Fallback: envia o PDF inteiro como inline file para Gemini 2.5 Flash
 * via Lovable AI Gateway e pede o texto bruto com marcadores [[PAGE n]].
 * Retorna { text, pages } — `pages` é o maior n encontrado nos marcadores
 * ou 1 quando o modelo não conseguir paginar.
 */
async function extractPdfViaGemini(
  storagePath: string,
  fileName: string,
): Promise<{ text: string; pages: number }> {
  if (!LOVABLE_API_KEY) {
    throw new Error("multimodal_fallback_unavailable: LOVABLE_API_KEY missing");
  }
  console.log("extract:fallback_start", { fileName });

  const svc = serviceClient();
  const { data: blob, error: dErr } = await svc.storage
    .from("client-documents")
    .download(storagePath);
  if (dErr || !blob) throw new Error(`fallback_download: ${dErr?.message ?? "no blob"}`);

  const bytes = new Uint8Array(await blob.arrayBuffer());
  console.log("extract:fallback_downloaded", { bytes: bytes.length });

  const prompt =
    "Extraia TODO o texto deste PDF, preservando a ordem das páginas. " +
    "Inicie cada página com um marcador exato no formato `[[PAGE n]]` em sua própria linha, " +
    "onde n é o número da página (começando em 1). Não resuma, não comente, não traduza. " +
    "Devolva apenas o texto bruto extraído. Se a página estiver em branco, escreva `[[PAGE n]]` " +
    "seguido de uma linha vazia.";

  // Para evitar estouro de memória ao fazer JSON.stringify de ~30 MB de base64,
  // montamos o corpo como ReadableStream: prefixo JSON + base64 em chunks + sufixo JSON.
  const escapedFilename = JSON.stringify(fileName);
  const escapedPrompt = JSON.stringify(prompt);
  const prefix =
    `{"model":"google/gemini-2.5-flash","messages":[{"role":"user","content":[` +
    `{"type":"file","file":{"filename":${escapedFilename},` +
    `"file_data":"data:application/pdf;base64,`;
  const suffix =
    `"}},{"type":"text","text":${escapedPrompt}}]}]}`;

  const encoder = new TextEncoder();
  const CHUNK_BYTES = 768 * 1024; // múltiplo de 3 — base64 sem padding intermediário

  const bodyStream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(prefix));
      let offset = 0;
      while (offset < bytes.length) {
        const end = Math.min(offset + CHUNK_BYTES, bytes.length);
        const slice = bytes.subarray(offset, end);
        const b64 = encodeBase64(slice);
        controller.enqueue(encoder.encode(b64));
        offset = end;
      }
      controller.enqueue(encoder.encode(suffix));
      controller.close();
    },
  });

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: bodyStream,
    // @ts-ignore Deno fetch suporta duplex para streaming de upload.
    duplex: "half",
  });

  const bodyText = await res.text();
  if (!res.ok) {
    console.error("extract:fallback_gateway_error", { status: res.status, body: bodyText.slice(0, 400) });
    if (res.status === 429) throw new Error("multimodal_rate_limited");
    if (res.status === 402) throw new Error("multimodal_credits_exhausted");
    throw new Error(`multimodal_gateway_${res.status}: ${bodyText.slice(0, 200)}`);
  }

  let parsed: any;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    throw new Error("multimodal_invalid_json_response");
  }
  const text: string = parsed?.choices?.[0]?.message?.content ?? "";
  if (!text || text.trim().length === 0) {
    throw new Error("multimodal_empty_text");
  }

  const pageMarkers = [...text.matchAll(/\[\[PAGE\s+(\d+)\]\]/g)].map((m) => Number(m[1]));
  const pages = pageMarkers.length > 0 ? Math.max(...pageMarkers) : 1;

  console.log("extract:fallback_ok", { chars: text.length, pages });
  return { text, pages };
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
    .select("id, organization_id, storage_path, file_type, file_size, file_name, extracted_text, extraction_version")
    .eq("id", body.file_id)
    .maybeSingle();
  if (fErr || !file) return json({ error: "file not found" }, 404);

  // PR-3.6 Onda 2: idempotência. Se já temos extracted_text na versão corrente
  // (pdfjs@v1) OU multimodal (v1-multimodal), pula a etapa.
  if (
    file.extracted_text &&
    (file.extraction_version === EXTRACTION_VERSION ||
      file.extraction_version === "v1-multimodal")
  ) {
    console.log("extract:skip_idempotent", { file_id: file.id, version: file.extraction_version });
    return json({ ok: true, skipped: true, chars: file.extracted_text.length });
  }

  await svc
    .from("client_files")
    .update({ pipeline_stage: "extracting", pipeline_last_error: null })
    .eq("id", file.id);

  console.log("extract:start", {
    file_id: file.id,
    file_size: file.file_size,
    file_type: file.file_type,
  });

  try {
    const isPdf =
      (file.file_type ?? "").toLowerCase().includes("pdf") ||
      (file.storage_path ?? "").toLowerCase().endsWith(".pdf");

    if (isPdf) {
      const sizeBytes = Number(file.file_size ?? 0);

      // Hard guard: o edge runtime não comporta encode/upload de PDFs muito grandes.
      // Falha limpa antes de queimar 3 tentativas com WORKER_RESOURCE_LIMIT.
      if (sizeBytes > HARD_MAX_PDF_BYTES) {
        const mb = (sizeBytes / (1024 * 1024)).toFixed(1);
        const limitMb = (HARD_MAX_PDF_BYTES / (1024 * 1024)).toFixed(0);
        throw new Error(
          `pdf_too_large_for_edge_runtime: ${mb} MB excede o limite de ${limitMb} MB. ` +
            `Divida o PDF em arquivos menores antes de reenviar.`,
        );
      }

      const useFallbackFirst = sizeBytes > LARGE_PDF_THRESHOLD;

      let extractedText: string | null = null;
      let totalPages = 0;
      let usedModel = EXTRACTION_MODEL_PDFJS;
      let usedVersion = EXTRACTION_VERSION;

      if (!useFallbackFirst) {
        // Tenta pdfjs streaming primeiro.
        try {
          const url = await signedUrl(file.storage_path);
          const pages: { page: number; text: string }[] = [];
          totalPages = await extractPdfStreaming(url, async (pageNum, text) => {
            pages.push({ page: pageNum, text });
          });
          extractedText = pages
            .map((p) => `\n\n[[PAGE ${p.page}]]\n${p.text}`)
            .join("");
          console.log("extract:pdfjs_ok", { pages: totalPages, chars: extractedText.length });
        } catch (e) {
          console.warn("extract:pdfjs_failed_fallback", { error: (e as Error).message });
          extractedText = null;
        }
      } else {
        console.log("extract:large_pdf_fallback", { size: sizeBytes });
      }

      if (extractedText === null) {
        // Fallback: Gemini multimodal.
        const fb = await extractPdfViaGemini(
          file.storage_path,
          file.file_name ?? "document.pdf",
        );
        extractedText = fb.text;
        totalPages = fb.pages;
        usedModel = EXTRACTION_MODEL_MULTIMODAL;
        usedVersion = EXTRACTION_VERSION_MULTIMODAL;
      }

      await svc
        .from("client_files")
        .update({
          extracted_text: extractedText,
          page_count: totalPages,
          extraction_version: usedVersion,
          extraction_model: usedModel,
          extraction_at: new Date().toISOString(),
          pipeline_stage: "extracting",
        })
        .eq("id", file.id);

      console.log("extract:persisted", {
        file_id: file.id,
        model: usedModel,
        version: usedVersion,
        pages: totalPages,
        chars: extractedText.length,
      });

      return json({
        ok: true,
        pages: totalPages,
        chars: extractedText.length,
        model: usedModel,
      });
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
    console.error("extract:error", { file_id: file.id, error: msg });
    await svc
      .from("client_files")
      .update({ pipeline_stage: "failed", pipeline_last_error: `extract: ${msg}` })
      .eq("id", file.id);
    return json({ error: msg }, 500);
  }
});
