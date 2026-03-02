import { supabase } from "@/integrations/supabase/client";

const MAX_THUMB_WIDTH = 400;
const THUMB_QUALITY = 0.7;

/**
 * Generate a thumbnail from an image File using canvas,
 * upload it to the thumbnails storage bucket,
 * and return the public URL.
 */
export async function generateAndUploadThumbnail(
  file: File,
  entryId: string
): Promise<string | null> {
  // Only generate thumbnails for images
  if (!file.type.startsWith("image/")) return null;

  try {
    const thumbBlob = await resizeImage(file, MAX_THUMB_WIDTH, THUMB_QUALITY);
    const ext = "jpg";
    const path = `${entryId}.${ext}`;

    const { error } = await supabase.storage
      .from("thumbnails")
      .upload(path, thumbBlob, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (error) {
      console.warn("Thumbnail upload failed:", error);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from("thumbnails")
      .getPublicUrl(path);

    return urlData.publicUrl;
  } catch (e) {
    console.warn("Thumbnail generation failed:", e);
    return null;
  }
}

/**
 * Delete a thumbnail from storage by entry ID.
 */
export async function deleteThumbnail(entryId: string): Promise<void> {
  // Try common extensions
  const { error } = await supabase.storage
    .from("thumbnails")
    .remove([`${entryId}.jpg`]);

  if (error) console.warn("Thumbnail delete failed:", error);
}

function resizeImage(file: File, maxWidth: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxWidth / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Canvas toBlob returned null"));
        },
        "image/jpeg",
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}
