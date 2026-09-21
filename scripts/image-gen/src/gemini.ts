// Minimal Gemini image-generation client.
//
// Uses Node's global fetch (Node 22) so this adds NO npm dependencies —
// package-lock.json stays untouched and `npm ci` keeps working unchanged.
//
// SECURITY: this repo is public, so GitHub Actions logs are world-readable.
// The key is sent in the x-goog-api-key header (never a query string, which
// would land in logs/history) and every error message is scrubbed before it
// is thrown. Nothing here logs the key.

const API_ROOT = "https://generativelanguage.googleapis.com/v1beta";

// Preference order when GEMINI_IMAGE_MODEL is not pinned. Google retires and
// renames model IDs periodically — a hardcoded ID silently 404s months later,
// which is a very plausible cause of the previous bot's death. So we discover
// what this key can actually call instead of assuming.
const MODEL_PREFERENCE = [
  "gemini-2.5-flash-image",
  "gemini-2.5-flash-image-preview",
  "gemini-2.0-flash-preview-image-generation",
  "imagen-3.0-generate-002",
];

interface ModelInfo {
  name: string;
  supportedGenerationMethods?: string[];
}

/** Replace the key with *** anywhere it might appear in a message. */
function scrub(text: string, apiKey: string): string {
  if (!apiKey) return text;
  return text.split(apiKey).join("***");
}

function looksImageCapable(name: string): boolean {
  return /image|imagen/i.test(name);
}

async function listModels(apiKey: string): Promise<string[]> {
  const res = await fetch(`${API_ROOT}/models?pageSize=200`, {
    headers: { "x-goog-api-key": apiKey },
  });
  if (!res.ok) {
    const hint =
      res.status === 400 || res.status === 403
        ? " — key is invalid/revoked, or the Generative Language API is not enabled for its project."
        : res.status === 429
        ? " — quota exhausted or billing inactive on the key's project."
        : "";
    throw new Error(`models.list failed: ${res.status} ${res.statusText}${hint}`);
  }
  const body = (await res.json()) as { models?: ModelInfo[] };
  return (body.models ?? [])
    .filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
    .map((m) => m.name.replace(/^models\//, ""));
}

/**
 * Pick an image-capable model this key can actually call.
 * Throws with the callable model list so a failing run is self-diagnosing.
 */
export async function resolveImageModel(
  apiKey: string,
  pinned?: string
): Promise<string> {
  const callable = await listModels(apiKey);

  if (pinned) {
    if (callable.includes(pinned)) return pinned;
    const imageish = callable.filter(looksImageCapable);
    throw new Error(
      `GEMINI_IMAGE_MODEL="${pinned}" is not callable with this key. ` +
        `Image-capable models available: ${imageish.join(", ") || "(none)"}`
    );
  }

  for (const want of MODEL_PREFERENCE) {
    if (callable.includes(want)) return want;
  }
  const fallback = callable.filter(looksImageCapable)[0];
  if (fallback) return fallback;

  throw new Error(
    "No image-capable model is available to this key. Image generation " +
      "typically requires a paid-tier project. Callable models: " +
      callable.slice(0, 40).join(", ")
  );
}

/**
 * Generate one illustration. Returns raw image bytes (usually PNG).
 *
 * Some image models require generationConfig.responseModalities while others
 * reject the field outright with a 400, so we attempt it and retry without.
 */
export async function generateImage(
  apiKey: string,
  model: string,
  prompt: string
): Promise<Buffer> {
  let lastErr = "";

  for (const withModalities of [true, false]) {
    const body: Record<string, unknown> = {
      contents: [{ parts: [{ text: prompt }] }],
    };
    if (withModalities) {
      body.generationConfig = { responseModalities: ["IMAGE"] };
    }

    const res = await fetch(`${API_ROOT}/models/${model}:generateContent`, {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      lastErr = `${res.status} ${res.statusText}: ${(await res.text()).slice(0, 400)}`;
      // A 400 may just mean this model dislikes responseModalities — retry bare.
      if (res.status === 400 && withModalities) continue;
      throw new Error(scrub(`generateContent failed: ${lastErr}`, apiKey));
    }

    const data = (await res.json()) as any;
    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    const inline = parts.find((p: any) => p?.inlineData?.data);

    if (!inline) {
      // Model replied with text instead of an image (refusal, safety block, or
      // a non-image model). Surface what it said — that's the useful signal.
      const said = parts
        .map((p: any) => p?.text)
        .filter(Boolean)
        .join(" ")
        .slice(0, 200);
      const finish = data?.candidates?.[0]?.finishReason;
      throw new Error(
        scrub(
          `no image in response (finishReason=${finish ?? "?"})` +
            (said ? ` — model said: ${said}` : ""),
          apiKey
        )
      );
    }

    const buf = Buffer.from(inline.inlineData.data, "base64");
    assertLooksLikeImage(buf);
    return buf;
  }

  throw new Error(scrub(`generateContent failed: ${lastErr}`, apiKey));
}

/**
 * Cheap sanity check on returned bytes. The previous pipeline committed some
 * malformed artifacts that needed manual repair later, so fail loudly here
 * rather than writing garbage into the repo.
 */
function assertLooksLikeImage(buf: Buffer): void {
  if (buf.length < 1024) {
    throw new Error(`returned image is implausibly small (${buf.length} bytes)`);
  }
  const isPng =
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  const isJpg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const isWebp =
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WEBP";
  if (!isPng && !isJpg && !isWebp) {
    throw new Error("returned bytes are not a recognizable PNG/JPEG/WebP image");
  }
}
