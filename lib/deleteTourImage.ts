import { supabase } from "@/lib/supabaseClient";

// ⚠️ Must match the bucket used by uploadTourImage
const TOUR_IMAGE_BUCKET = "tour_images";

function getStoragePathFromPublicUrl(publicUrl: string) {
  // Works for URLs like:
  // https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
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

export async function deleteTourImage(tourId: string, imageUrl: string) {
  const parsed = getStoragePathFromPublicUrl(imageUrl);

  // Prefer deleting from the URL's bucket if it parses cleanly,
  // otherwise fall back to TOUR_IMAGE_BUCKET.
  const bucket = parsed?.bucket || TOUR_IMAGE_BUCKET;
  const path = parsed?.path || null;

  if (path) {
    const { error: storageErr } = await supabase.storage.from(bucket).remove([path]);

    if (storageErr) {
      // Non-fatal: we still clear the DB field so the app doesn't keep pointing at a bad URL.
      console.warn("Storage delete failed:", storageErr.message);
    }
  }

  const { error: dbErr } = await supabase
    .from("tours")
    .update({ cover_image_url: null, updated_at: new Date().toISOString() })
    .eq("id", tourId);

  if (dbErr) throw dbErr;

  return true;
}
