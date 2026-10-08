const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;

/** Resolve a stored image path: absolute URLs and site paths (seed data) pass through; others are storage paths. */
export function imageUrl(path: string | null | undefined, bucket: "listing-images" | "store-assets" | "review-images" = "listing-images") {
  if (!path) return "/seed/placeholder.svg";
  if (path.startsWith("/") || path.startsWith("http")) return path;
  return `${BASE}/storage/v1/object/public/${bucket}/${path}`;
}

export function firstImage(images: { path: string; position: number }[] | null | undefined) {
  if (!images?.length) return imageUrl(null);
  return imageUrl([...images].sort((a, b) => a.position - b.position)[0].path);
}

/** Uploads write a ~400px thumbnail next to the full image as `<name>_t.webp` (cards load this, not the 1280px original). */
export function thumbPath(path: string) {
  return path.replace(/\.webp$/, "_t.webp");
}

/** Thumbnail URL for one stored path. Seed/site-relative images have no separate thumbnail. */
export function thumbUrl(path: string | null | undefined) {
  if (!path) return imageUrl(null);
  if (path.startsWith("/") || path.startsWith("http")) return imageUrl(path);
  return imageUrl(thumbPath(path));
}

/** Card thumbnail: the first (cover) image's thumbnail. */
export function firstThumb(images: { path: string; position: number }[] | null | undefined) {
  if (!images?.length) return imageUrl(null);
  return thumbUrl([...images].sort((a, b) => a.position - b.position)[0].path);
}
