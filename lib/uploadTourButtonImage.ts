import { supabase } from "@/lib/supabaseClient";

const BUCKET = "tour-audio";

export type TourButtonImageKey =
  | "highlights_image_url"
  | "map_image_url"
  | "start_image_url";

function safeFileName(name: string) {
  return name
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .toLowerCase();
}

/**
 * Uploads a tour button image into Storage and writes the public URL to the chosen column.
 */
export async function uploadTourButtonImage(
  tourId: string,
  file: File,
  key: TourButtonImageKey
) {
  if (!tourId) throw new Error("tourId is required");
  if (!file) throw new Error("file is required");

  const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
  const base = safeFileName(file.name || `image.${ext}`);

  // Keep separate folders per CTA button
  const folder =
    key === "highlights_image_url"
      ? "highlights"
      : key === "map_image_url"
      ? "map"
      : "start";

  const path = `tours/${tourId}/images/${folder}/${Date.now()}-${base}`;

  const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: file.type || undefined,
  });

  if (uploadErr) throw uploadErr;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = data.publicUrl;

  const { error: dbErr } = await supabase
    .from("tours")
    .update({ [key]: publicUrl, updated_at: new Date().toISOString() })
    .eq("id", tourId);

  if (dbErr) throw dbErr;

  return publicUrl;
}
