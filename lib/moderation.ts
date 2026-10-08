/**
 * Image moderation hook (Phase 1: stub).
 *
 * Every image a user uploads passes through `moderateImage` before it is accepted. Today it only
 * checks type/size. To plug in a real provider (AWS Rekognition, Google Vision, Sightengine…),
 * implement the `ModerationProvider` interface and set it via `setModerationProvider`, or call it
 * from a Supabase Edge Function on storage upload. Keep the interface provider-agnostic.
 */
export type ModerationResult = { allowed: boolean; reason?: string };

export interface ModerationProvider {
  moderate(file: { name: string; type: string; size: number }, bytes?: ArrayBuffer): Promise<ModerationResult>;
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024;

const basicProvider: ModerationProvider = {
  async moderate(file) {
    if (!ALLOWED_TYPES.includes(file.type)) return { allowed: false, reason: "Only JPG, PNG or WebP images are allowed." };
    if (file.size > MAX_BYTES) return { allowed: false, reason: "Image is too large (max 2 MB)." };
    return { allowed: true };
  },
};

let provider: ModerationProvider = basicProvider;
export function setModerationProvider(p: ModerationProvider) {
  provider = p;
}

export function moderateImage(file: { name: string; type: string; size: number }, bytes?: ArrayBuffer) {
  return provider.moderate(file, bytes);
}
