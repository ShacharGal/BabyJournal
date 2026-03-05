import { supabase } from "@/integrations/supabase/client";

const BUCKET = "audio";

function getExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot >= 0 ? fileName.slice(dot) : ".webm";
}

export async function uploadAudio(
  file: File,
  entryId: string
): Promise<{ storagePath: string; publicUrl: string }> {
  const ext = getExtension(file.name);
  const storagePath = `${entryId}${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { upsert: true, contentType: file.type });

  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

  return { storagePath, publicUrl: data.publicUrl };
}

export async function deleteAudio(storagePath: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (error) console.warn("Failed to delete audio file:", error);
}
