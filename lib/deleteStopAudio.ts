import { supabase } from "@/lib/supabaseClient";

function getStoragePathFromPublicUrl(publicUrl: string) {
  const marker = "/storage/v1/object/public/";
  const i = publicUrl.indexOf(marker);
  if (i === -1) return null;

  const after = publicUrl.slice(i + marker.length); // "<bucket>/<path>"
  const firstSlash = after.indexOf("/");
  if (firstSlash === -1) return null;

  const bucket = after.slice(0, firstSlash);
  const path = after.slice(firstSlash + 1);
  if (!bucket || !path) return null;

  return { bucket, path };
}

export async function deleteStopAudio(stopId: string, audioUrl: string) {
  const parsed = getStoragePathFromPublicUrl(audioUrl);

  // Best-effort storage delete
  if (parsed?.path) {
    const { error: storageErr } = await supabase.storage
      .from(parsed.bucket)
      .remove([parsed.path]);

    if (storageErr) {
      console.warn("Storage delete failed:", storageErr.message);
    }
  }

  // Clear DB pointer
  const { error: dbErr } = await supabase
    .from("stops")
    .update({ audio_url: null, updated_at: new Date().toISOString() })
    .eq("id", stopId);

  if (dbErr) throw dbErr;

  return true;
}
