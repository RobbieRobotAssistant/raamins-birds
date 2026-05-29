import type { Config } from "./config.js";

export interface GeneratedImage {
  bytes: Buffer;
  ext: string;
}

// Pluggable image provider. Default ("none") generates nothing, so the
// frontend renders a common-name text placeholder — the signal to drop a real
// image into ./provided-images. "openai" is intentionally a stub: per project
// decision, illustrations are supplied manually for now.
export async function generateImage(
  cfg: Config,
  sciName: string,
  comName: string
): Promise<GeneratedImage | null> {
  if (cfg.provider === "openai") {
    if (!cfg.openaiKey) {
      console.warn(
        `[provider] IMAGE_PROVIDER=openai but OPENAI_API_KEY is empty; skipping ${sciName}`
      );
      return null;
    }
    // TODO: implement OpenAI Images. When ready, call:
    //   POST https://api.openai.com/v1/images/generations
    //   body: { model: cfg.openaiModel, n: 1, size: "1024x1024",
    //           prompt: `A clean naturalist field-guide illustration of a
    //                    ${comName} (${sciName}), neutral background.` }
    //   then decode b64_json -> Buffer and return { bytes, ext: "png" }.
    // Mark the result imageIsAi:true in index.ts so the UI shows the
    // "AI illustration" caption.
    throw new Error(
      "OpenAI provider not implemented yet — see scripts/image-gen/src/providers.ts TODO"
    );
  }

  // provider "none": no generation.
  void comName;
  return null;
}
