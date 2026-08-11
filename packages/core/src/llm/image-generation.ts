import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  coverSecretKey,
  normalizeCoverBaseUrl,
  resolveCoverProviderPreset,
  type CoverProviderPreset,
} from "./cover-providers.js";
import { loadSecrets } from "./secrets.js";

/**
 * Generate one image from a free-text prompt via whichever image API the cover
 * config resolves to (gemini / images / responses). Shared by the interactive-
 * film node images and the interactive-world (Play) illustration feature so
 * both go through the same provider plumbing.
 */
export async function generateImageFromPrompt(
  request: ShortFictionCoverRequest,
  prompt: string,
  size: string,
  signal?: AbortSignal,
): Promise<{ readonly buffer: Buffer; readonly extension: "png" | "jpg" }> {
  if (request.api === "gemini") {
    const payload = await generateGeminiCover(request, prompt, signal);
    return { buffer: Buffer.from(payload.base64, "base64"), extension: payload.extension };
  }
  if (request.api === "images") {
    return generateImagesCover(request, prompt, size, signal);
  }

  const endpoint = request.endpoint ?? `${request.baseUrl.replace(/\/+$/u, "")}/responses`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${request.apiKey}`,
    },
    body: JSON.stringify({
      model: request.model,
      input: prompt,
      tools: [{ type: "image_generation", size }],
    }),
    signal,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`image generation failed: HTTP ${response.status} ${text.slice(0, 500)}`);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    throw new Error(`image generation returned non-JSON response: ${String(error)}`);
  }

  const imageBase64 = extractResponsesImageBase64(payload);
  if (!imageBase64) {
    throw new Error("image generation response did not include image_generation_call result.");
  }
  return { buffer: Buffer.from(imageBase64, "base64"), extension: "png" };
}

export interface ShortFictionCoverRequest {
  readonly api: CoverProviderPreset["api"];
  readonly baseUrl: string;
  readonly endpoint?: string;
  readonly model: string;
  readonly apiKey: string;
}

export async function resolveCoverGenerationRequest(input: {
  readonly root: string;
  readonly coverBaseUrl?: string;
  readonly coverEndpoint?: string;
  readonly coverModel?: string;
  readonly coverApiKeyEnv?: string;
}): Promise<ShortFictionCoverRequest> {
  if (input.coverEndpoint || input.coverBaseUrl || process.env.INKOS_COVER_ENDPOINT || process.env.INKOS_COVER_BASE_URL) {
    const endpoint = resolveCoverEndpoint(input.coverEndpoint, input.coverBaseUrl);
    const baseUrl = input.coverBaseUrl || process.env.INKOS_COVER_BASE_URL || endpoint
      .replace(/\/responses\/?$/u, "")
      .replace(/\/images\/generations\/?$/u, "");
    return {
      api: endpoint.includes("/responses") ? "responses" : "images",
      baseUrl,
      endpoint,
      model: input.coverModel || process.env.INKOS_COVER_MODEL || "gpt-image-2",
      apiKey: resolveCoverApiKey(input.coverApiKeyEnv || "INKOS_COVER_API_KEY"),
    };
  }

  const projectCover = await readProjectCoverConfig(input.root);
  if (!projectCover) {
    throw new Error("cover endpoint is required. Configure cover generation in Studio or set INKOS_COVER_BASE_URL.");
  }

  const preset = resolveCoverProviderPreset(projectCover.service);
  if (!preset) {
    throw new Error(`Unsupported cover service: ${projectCover.service}`);
  }
  const apiKey = await resolveProjectCoverApiKey(input.root, projectCover.service);
  if (!apiKey) {
    throw new Error(`Cover API key is required. Configure a cover key for ${preset.label}.`);
  }

  return {
    api: preset.api,
    baseUrl: projectCover.baseUrl || preset.baseUrl,
    model: input.coverModel || projectCover.model || preset.defaultModel,
    apiKey,
  };
}

async function readProjectCoverConfig(root: string): Promise<{
  readonly service: string;
  readonly model?: string;
  readonly baseUrl?: string;
} | undefined> {
  try {
    const raw = await readFile(join(root, "inkos.json"), "utf-8");
    const parsed = JSON.parse(raw) as {
      llm?: { cover?: { service?: unknown; model?: unknown; baseUrl?: unknown } };
    };
    const service = typeof parsed.llm?.cover?.service === "string" ? parsed.llm.cover.service : "";
    if (!service) return undefined;
    const baseUrl = normalizeCoverBaseUrl(parsed.llm?.cover?.baseUrl);
    return {
      service,
      ...(typeof parsed.llm?.cover?.model === "string" && parsed.llm.cover.model.trim()
        ? { model: parsed.llm.cover.model.trim() }
        : {}),
      ...(baseUrl ? { baseUrl } : {}),
    };
  } catch {
    return undefined;
  }
}

async function resolveProjectCoverApiKey(root: string, service: string): Promise<string> {
  const secrets = await loadSecrets(root);
  return secrets.services[coverSecretKey(service)]?.apiKey
    || secrets.services[service]?.apiKey
    || process.env[`${service.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase()}_API_KEY`]
    || "";
}

async function generateImagesCover(
  request: ShortFictionCoverRequest,
  prompt: string,
  size: string,
  signal?: AbortSignal,
): Promise<{ readonly buffer: Buffer; readonly extension: "png" | "jpg" }> {
  const endpoint = request.endpoint ?? `${request.baseUrl.replace(/\/+$/u, "")}/images/generations`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${request.apiKey}`,
    },
    body: JSON.stringify({
      model: request.model,
      prompt,
      n: 1,
      size,
    }),
    signal,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`cover generation failed: HTTP ${response.status} ${text.slice(0, 500)}`);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    throw new Error(`cover generation returned non-JSON response: ${String(error)}`);
  }

  const image = extractImagesGenerationImage(payload);
  if (image?.base64) {
    return {
      buffer: Buffer.from(image.base64, "base64"),
      extension: image.extension,
    };
  }
  if (image?.url) {
    return downloadGeneratedCoverImage(image.url, request.apiKey, signal);
  }
  throw new Error("cover generation response did not include image URL or base64 data.");
}

export function extractImagesGenerationImage(payload: unknown): (
  | { readonly base64: string; readonly extension: "png" | "jpg"; readonly url?: undefined }
  | { readonly url: string; readonly base64?: undefined; readonly extension?: undefined }
) | undefined {
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) return undefined;

  for (const item of data) {
    const record = item as { b64_json?: unknown; url?: unknown };
    if (typeof record.b64_json === "string" && record.b64_json.trim()) {
      return { base64: record.b64_json.trim(), extension: "png" };
    }
    if (typeof record.url === "string" && record.url.trim()) {
      return { url: record.url.trim() };
    }
  }

  return undefined;
}

async function downloadGeneratedCoverImage(
  url: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<{ readonly buffer: Buffer; readonly extension: "png" | "jpg" }> {
  const response = await fetch(url, { signal });
  const fallbackResponse = response.status === 401 || response.status === 403
    ? await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` }, signal })
    : response;
  if (!fallbackResponse.ok) {
    const text = await fallbackResponse.text();
    throw new Error(`cover image download failed: HTTP ${fallbackResponse.status} ${text.slice(0, 300)}`);
  }
  const contentType = fallbackResponse.headers.get("content-type") ?? "";
  const buffer = Buffer.from(await fallbackResponse.arrayBuffer());
  return {
    buffer,
    extension: coverImageExtension(contentType, url),
  };
}

function coverImageExtension(contentType: string, url: string): "png" | "jpg" {
  const normalized = `${contentType} ${url}`.toLowerCase();
  return normalized.includes("jpeg") || normalized.includes(".jpg") || normalized.includes(".jpeg") ? "jpg" : "png";
}

async function generateGeminiCover(
  request: ShortFictionCoverRequest,
  prompt: string,
  signal?: AbortSignal,
): Promise<{ readonly base64: string; readonly extension: "png" | "jpg" }> {
  const endpoint = `${request.baseUrl.replace(/\/+$/u, "")}/models/${encodeURIComponent(request.model)}:generateContent?key=${encodeURIComponent(request.apiKey)}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
    }),
    signal,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`cover generation failed: HTTP ${response.status} ${text.slice(0, 500)}`);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    throw new Error(`cover generation returned non-JSON response: ${String(error)}`);
  }

  const image = extractGeminiImageBase64(payload);
  if (!image) {
    throw new Error("cover generation response did not include Gemini inline image data.");
  }
  return image;
}

export function extractResponsesImageBase64(payload: unknown): string | undefined {
  const output = (payload as { output?: unknown }).output;
  if (!Array.isArray(output)) return undefined;

  for (const item of output) {
    const record = item as { type?: unknown; result?: unknown; content?: unknown };
    if (record.type === "image_generation_call" && typeof record.result === "string" && record.result.trim()) {
      return record.result.trim();
    }
    if (Array.isArray(record.content)) {
      for (const contentItem of record.content) {
        const contentRecord = contentItem as { result?: unknown; image_base64?: unknown };
        if (typeof contentRecord.result === "string" && contentRecord.result.trim()) return contentRecord.result.trim();
        if (typeof contentRecord.image_base64 === "string" && contentRecord.image_base64.trim()) return contentRecord.image_base64.trim();
      }
    }
  }

  return undefined;
}

export function extractGeminiImageBase64(payload: unknown): { readonly base64: string; readonly extension: "png" | "jpg" } | undefined {
  const candidates = (payload as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates)) return undefined;

  for (const candidate of candidates) {
    const parts = (candidate as { content?: { parts?: unknown } }).content?.parts;
    if (!Array.isArray(parts)) continue;
    for (const part of parts) {
      const inlineData = (part as { inlineData?: unknown; inline_data?: unknown }).inlineData
        ?? (part as { inlineData?: unknown; inline_data?: unknown }).inline_data;
      const record = inlineData as { data?: unknown; mimeType?: unknown; mime_type?: unknown } | undefined;
      if (typeof record?.data !== "string" || !record.data.trim()) continue;
      const mimeType = String(record.mimeType ?? record.mime_type ?? "image/png").toLowerCase();
      return {
        base64: record.data.trim(),
        extension: mimeType.includes("jpeg") || mimeType.includes("jpg") ? "jpg" : "png",
      };
    }
  }

  return undefined;
}

export function resolveCoverApiKey(apiKeyEnv: string): string {
  const apiKey = process.env[apiKeyEnv];
  if (!apiKey) {
    throw new Error(`Cover API key is required. Set ${apiKeyEnv} or pass coverApiKeyEnv.`);
  }
  return apiKey;
}

function resolveCoverEndpoint(coverEndpoint?: string, coverBaseUrl?: string): string {
  const endpoint = coverEndpoint || process.env.INKOS_COVER_ENDPOINT;
  if (endpoint) return endpoint;
  const baseUrl = coverBaseUrl || process.env.INKOS_COVER_BASE_URL;
  if (!baseUrl) {
    throw new Error("cover endpoint is required. Set INKOS_COVER_BASE_URL or disable cover generation.");
  }
  return `${baseUrl.replace(/\/+$/u, "")}/images/generations`;
}
