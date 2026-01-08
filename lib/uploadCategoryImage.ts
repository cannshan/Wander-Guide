import { supabase } from "@/lib/supabaseClient";

/**
 * Uploads a category cover image to Supabase Storage and returns a public URL.
 *
 * Bucket: tour-audio (reusing existing bucket used for stop images/audio)
 * Path: categories/{categoryId}/cover/{uuid}.{ext}
 */
export async function uploadCategoryImage(file: File, categoryId: string) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";

  const path = `categories/${categoryId}/cover/${crypto.randomUUID()}.${safeExt}`;

  const { error } = await supabase.storage.from("tour-audio").upload(path, file, {
    upsert: true,
    cacheControl: "3600",
    contentType: file.type || "image/jpeg",
  });

  if (error) throw error;

  const { data } = supabase.storage.from("tour-audio").getPublicUrl(path);
  if (!data?.publicUrl) throw new Error("Failed to get public URL for category image");

  return data.publicUrl;
}
