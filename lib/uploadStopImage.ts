import { supabase } from "@/lib/supabaseClient";

export async function uploadStopImage(file: File, stopId: string) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";

  const path = `stops/${stopId}/images/${crypto.randomUUID()}.${safeExt}`;

  const { error } = await supabase.storage
    .from("tour-audio")
    .upload(path, file, {
      upsert: true,
      cacheControl: "3600",
      contentType: file.type || "image/jpeg",
    });

  if (error) throw error;

  const { data } = supabase.storage.from("tour-audio").getPublicUrl(path);
  if (!data?.publicUrl) throw new Error("Failed to get public URL for image");

  return data.publicUrl;
}
