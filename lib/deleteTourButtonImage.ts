import { supabase } from "@/lib/supabaseClient";
import type { TourButtonImageKey } from "@/lib/uploadTourButtonImage";

const DEFAULT_BUCKET = "tour-audio";

function getStoragePathFromPublicUrl(publicUrl: string) {
  const marker = "/storage/v1/object/public/";
  const i = publicUrl.indexOf(marker);
  if (i === -1) return null;

  const after = publicUrl.slice(i + marker.length); // "<bucket>/<path>"
  const firstSlash = after.indexOf("/");
  if (firstSlash === -1) return null;

  const bucket = after.slice(0, firstSlash);
  const path = after.slice(firstSlash + 1);
  return { bucket, path };
}

/**
 * Deletes the Storage object best-effort and clears the chosen column in tours.
 */
export async function deleteTourButtonImage(
  tourId: string,
  imageUrl: string,
  key: TourButtonImageKey
) {
  if (!tourId) throw new Error("tourId is required");
  if (!imageUrl) return true;

  const parsed = getStoragePathFromPublicUrl(imageUrl);
  const bucket = parsed?.bucket || DEFAULT_BUCKET;
  const path = parsed?.path ?? null;

  if (path) {
    const { error: storageErr } = await supabase.storage.from(bucket).remove([path]);
    if (storageErr) {
      // Non-fatal: still clear the DB field so UI stops referencing it
      console.warn("Failed to delete from storage:", storageErr.message);
    }
  }

  const { error: dbErr } = await supabase
    .from("tours")
    .update({ [key]: null, updated_at: new Date().toISOString() })
    .eq("id", tourId);

  if (dbErr) throw dbErr;

  return true;
}
