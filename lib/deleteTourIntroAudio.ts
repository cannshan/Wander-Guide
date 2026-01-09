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

export async function deleteTourIntroAudio(tourId: string, audioUrl: string) {
  const parsed = getStoragePathFromPublicUrl(audioUrl);

  // Best-effort storage delete
  if (parsed?.bucket && parsed?.path) {
    const { error: storageErr } = await supabase.storage
      .from(parsed.bucket)
      .remove([parsed.path]);

    if (storageErr) {
      console.warn("Intro audio storage delete failed:", storageErr.message);
    }
  } else {
    console.warn("Could not parse intro audio storage path from URL");
  }

  // Clear DB pointer
  const { error: dbErr } = await supabase
    .from("tours")
    .update({ intro_audio_url: null, updated_at: new Date().toISOString() })
    .eq("id", tourId);

  if (dbErr) throw dbErr;

  return true;
}
