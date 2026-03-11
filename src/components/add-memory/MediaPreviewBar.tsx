import { useMemo } from "react";
import { X, Mic, Video } from "lucide-react";
import type { AddMemoryFormReturn } from "./useAddMemoryForm";

interface MediaPreviewBarProps {
  form: AddMemoryFormReturn;
}

function MediaThumbnail({
  src,
  isVideo,
  onRemove,
}: {
  src: string;
  isVideo?: boolean;
  onRemove: () => void;
}) {
  return (
    <div className="relative w-14 h-14 rounded-lg overflow-hidden border shrink-0 bg-muted">
      <img src={src} alt="" className="w-full h-full object-cover" />
      {isVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <Video className="h-4 w-4 text-white" />
        </div>
      )}
      <button
        type="button"
        className="absolute -top-0.5 -right-0.5 h-5 w-5 rounded-full bg-black/70 flex items-center justify-center"
        onClick={onRemove}
      >
        <X className="h-3 w-3 text-white" />
      </button>
    </div>
  );
}

export function MediaPreviewBar({ form }: MediaPreviewBarProps) {
  const {
    file, secondaryFiles, audioFile,
    isEditing, editEntry,
    removeExistingFile, removeExistingAudio, removeSecondaryIds,
    hasRecording, hasAnyAudio, existingAudioName,
    removePrimaryFile, removeExistingPrimaryFile,
    removeSecondaryAtIndex, markSecondaryForRemoval,
    removeAudio, removeExistingAudioFile,
  } = form;

  const safeSecondaryFiles = Array.isArray(secondaryFiles) ? secondaryFiles : [];
  const safeRemoveSecondaryIds = Array.isArray(removeSecondaryIds) ? removeSecondaryIds : [];

  console.log("[MediaPreview] render", {
    hasFile: !!file,
    secondaryFilesType: typeof secondaryFiles,
    secondaryFilesIsArray: Array.isArray(secondaryFiles),
    secondaryFilesLen: safeSecondaryFiles.length,
    isEditing,
    removeSecondaryIdsType: typeof removeSecondaryIds,
  });

  // Create object URLs for new files
  const primaryUrl = useMemo(() => file ? URL.createObjectURL(file) : null, [file]);
  const secondaryUrls = useMemo(
    () => safeSecondaryFiles.map((f) => URL.createObjectURL(f)),
    [safeSecondaryFiles]
  );

  const hasExistingPrimary = isEditing && editEntry?.thumbnail_url && !removeExistingFile && !file;
  const existingSecondaryImages = isEditing && Array.isArray(editEntry?.entry_images)
    ? editEntry!.entry_images!.filter((img) => !safeRemoveSecondaryIds.includes(img.id))
    : [];
  const hasExistingAudio = isEditing && existingAudioName && !removeExistingAudio;
  const showAudio = audioFile || hasRecording || hasExistingAudio;

  const hasAnything =
    !!file ||
    !!hasExistingPrimary ||
    existingSecondaryImages.length > 0 ||
    safeSecondaryFiles.length > 0 ||
    showAudio;

  if (!hasAnything) return null;

  return (
    <div className="px-4 py-2 border-t">
      <div className="flex gap-2 overflow-x-auto">
        {/* New primary file */}
        {file && primaryUrl && (
          <MediaThumbnail
            src={primaryUrl}
            isVideo={file.type.startsWith("video/")}
            onRemove={removePrimaryFile}
          />
        )}

        {/* Existing primary (edit mode) */}
        {hasExistingPrimary && (
          <MediaThumbnail
            src={editEntry!.thumbnail_url!}
            isVideo={editEntry!.mime_type?.startsWith("video/") ?? false}
            onRemove={removeExistingPrimaryFile}
          />
        )}

        {/* Existing secondary images (edit mode) */}
        {existingSecondaryImages.map((img) => (
          <MediaThumbnail
            key={img.id}
            src={img.thumbnail_url || ""}
            onRemove={() => markSecondaryForRemoval(img.id)}
          />
        ))}

        {/* New secondary files */}
        {safeSecondaryFiles.map((f, i) => (
          <MediaThumbnail
            key={`new-${i}`}
            src={secondaryUrls[i]}
            isVideo={f.type.startsWith("video/")}
            onRemove={() => removeSecondaryAtIndex(i)}
          />
        ))}

        {/* Audio indicator */}
        {showAudio && (
          <div className="relative w-14 h-14 rounded-lg bg-muted flex items-center justify-center shrink-0 border">
            <Mic className="h-5 w-5 text-muted-foreground" />
            <button
              type="button"
              className="absolute -top-0.5 -right-0.5 h-5 w-5 rounded-full bg-black/70 flex items-center justify-center"
              onClick={isEditing && existingAudioName && !audioFile && !hasRecording ? removeExistingAudioFile : removeAudio}
            >
              <X className="h-3 w-3 text-white" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
