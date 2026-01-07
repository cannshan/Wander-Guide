import { supabase } from "@/lib/supabaseClient";

function getStoragePathFromPublicUrl(publicUrl: string) {
  // Works for URLs like:
  // https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
  const marker = "/storage/v1/object/public/";
  const i = publicUrl.indexOf(marker);
  if (i === -1) return null;

  const after = publicUrl.slice(i + marker.length); // "<bucket>/<path>"
  const firstSlash = after.indexOf("/");
  if (firstSlash === -1) return null;

  // return just "<path>"
  return after.slice(firstSlash + 1);
}

export async function deleteStopImage(stopId: string, imageUrl: string) {
  const path = getStoragePathFromPublicUrl(imageUrl);

  // Always clear DB even if storage deletion fails (optional, but practical)
  // We'll try storage delete first though.
  if (path) {
    const { error: storageErr } = await supabase.storage
      .from("tour_audio") // ✅ your bucket
      .remove([path]);

    if (storageErr) {
      // If you want strict behavior, throw here instead.
      console.warn("Storage delete failed:", storageErr.message);
    }
  }

  const { error: dbErr } = await supabase
    .from("stops")
    .update({ image_url: null, updated_at: new Date().toISOString() })
    .eq("id", stopId);

  if (dbErr) throw dbErr;

  return true;
}
