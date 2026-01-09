import { supabase } from "@/lib/supabaseClient";

export async function deleteTourIntroAudio(
  tourId: string,
  audioUrl: string
) {
  if (!audioUrl) return;

  // Extract storage path from public URL
  const path = audioUrl.split("/storage/v1/object/public/")[1];

  if (!path) throw new Error("Invalid audio URL");

  // Delete file from storage
  const { error: storageError } = await supabase.storage
    .from("audio")
    .remove([path]);

  if (storageError) throw storageError;

  // Clear DB field
  const { error: dbError } = await supabase
    .from("tours")
    .update({ intro_audio_url: null, updated_at: new Date().toISOString() })
    .eq("id", tourId);

  if (dbError) throw dbError;
}
