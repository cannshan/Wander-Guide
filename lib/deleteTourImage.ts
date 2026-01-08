import { supabase } from "@/lib/supabaseClient";

// ✅ Uses existing bucket
const TOUR_IMAGE_BUCKET = "tour-audio";

function getStoragePathFromPublicUrl(publicUrl: string) {
  // Expected format:
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

export async function deleteTourImage(
  tourId: string,
  imageUrl: string
) {
  if (!imageUrl) return true;

  const parsed = getStoragePathFromPublicUrl(imageUrl);

  const bucket = parsed?.bucket || TOUR_IMAGE_BUCKET;
  const path = parsed?.path ?? null;

  if (path) {
    const { error: storageErr } = await supabase.storage
      .from(bucket)
      .remove([path]);

    // Non-fatal: still clear DB field
    if (storageErr) {
      console.warn("Failed to delete tour image from storage:", storageErr.message);
    }
  }

  const { error: dbErr } = await supabase
    .from("tours")
    .update({
      cover_image_url: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tourId);

  if (dbErr) throw dbErr;

  return true;
}
