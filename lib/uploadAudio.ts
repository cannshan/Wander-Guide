import { supabase } from "@/lib/supabaseClient";

/**
 * Upload an audio file to the `tour-audio` storage bucket
 * and return its public URL.
 *
 * @param file - The audio file selected by the admin
 * @param objectPath - Path without extension (e.g. tours/{tourId}/intro/{uuid})
 */
export async function uploadAudio(file: File, objectPath: string) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "mp3";
  const safeExt = ["mp3", "m4a", "wav"].includes(ext) ? ext : "mp3";
  const finalPath = `${objectPath}.${safeExt}`;

  const { error } = await supabase.storage
    .from("tour-audio")
    .upload(finalPath, file, {
      upsert: true,
      cacheControl: "3600",
      contentType: file.type || "audio/mpeg",
    });

  if (error) {
    console.error("Audio upload failed:", error);
    throw error;
  }

  const { data } = supabase.storage
    .from("tour-audio")
    .getPublicUrl(finalPath);

  if (!data?.publicUrl) {
    throw new Error("Failed to generate public audio URL");
  }

  return data.publicUrl;
}
