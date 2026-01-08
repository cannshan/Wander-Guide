import { supabase } from "@/lib/supabaseClient";

// ⚠️ Set this to your actual Supabase Storage bucket for images.
// If you're currently storing images in a different bucket (e.g. "tour_audio"),
// change this constant to match.
const TOUR_IMAGE_BUCKET = "tour_images";

function safeFileName(name: string) {
  return name
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .toLowerCase();
}

/**
 * Uploads a tour cover image to Supabase Storage and writes the public URL to tours.cover_image_url.
 *
 * Usage (Next.js):
 *   const url = await uploadTourImage(tourId, file)
 */
export async function uploadTourImage(tourId: string, file: File) {
  if (!tourId) throw new Error("tourId is required");
  if (!file) throw new Error("file is required");

  const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
  const base = safeFileName(file.name || `cover.${ext}`);
  const path = `tours/${tourId}/${Date.now()}-${base}`;

  const { error: uploadErr } = await supabase.storage
    .from(TOUR_IMAGE_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type || undefined,
    });

  if (uploadErr) throw uploadErr;

  const { data } = supabase.storage.from(TOUR_IMAGE_BUCKET).getPublicUrl(path);
  const publicUrl = data.publicUrl;

  const { error: dbErr } = await supabase
    .from("tours")
    .update({ cover_image_url: publicUrl, updated_at: new Date().toISOString() })
    .eq("id", tourId);

  if (dbErr) throw dbErr;

  return publicUrl;
}
