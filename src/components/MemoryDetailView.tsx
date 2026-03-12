import { useState, useEffect, useRef, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Pencil, Trash2, Loader2, Mic, Heart, ChevronLeft, ChevronRight } from "lucide-react";
import { format, differenceInMonths, differenceInYears, differenceInDays } from "date-fns";
import { parseDialogueText } from "@/lib/dialogueParser";
import { driveStreamUrl } from "@/lib/driveStreamUrl";
import type { EntryWithTags } from "@/hooks/useEntries";

function formatAgeAtDate(dateOfBirth: string, memoryDate: string): string {
  const dob = new Date(dateOfBirth);
  const d = new Date(memoryDate);
  const months = differenceInMonths(d, dob);
  if (months < 1) {
    const days = differenceInDays(d, dob);
    return `${days} day${days !== 1 ? "s" : ""} old`;
  }
  if (months < 24) {
    return `${months} month${months !== 1 ? "s" : ""} old`;
  }
  const years = differenceInYears(d, dob);
  const rem = months - years * 12;
  return rem > 0
    ? `${years}y ${rem}m old`
    : `${years} year${years !== 1 ? "s" : ""} old`;
}

interface MemoryDetailViewProps {
  entry: EntryWithTags;
  babyName: string;
  babyDob: string | null;
  canEdit: boolean;
  onClose: () => void;
  onEdit: (entry: EntryWithTags) => void;
  onDelete: (id: string) => void;
  isFavorited?: boolean;
  onToggleFavorite?: () => void;
  allEntries?: EntryWithTags[];
  onNavigate?: (entry: EntryWithTags) => void;
}

export function MemoryDetailView({
  entry,
  babyName,
  babyDob,
  canEdit,
  onClose,
  onEdit,
  onDelete,
  isFavorited = false,
  onToggleFavorite,
  allEntries,
  onNavigate,
}: MemoryDetailViewProps) {
  const audioUrl = (entry as any).audio_url as string | null;
  const hasThumbnail = !!entry.thumbnail_url;
  const isPhoto = entry.type === "photo";
  const isVideo = entry.type === "video";
  const canPlayVideo = isVideo && !!entry.drive_file_id;
  const hasAudio = !!audioUrl;
  const isDialogue = (entry as any).post_type === "dialogue";
  // Fallback: if no thumbnail but has drive_file_id and is a photo, use drive-stream
  const heroImageUrl = entry.thumbnail_url
    || (isPhoto && entry.drive_file_id ? driveStreamUrl(entry.drive_file_id) : null);
  const hasHeroImage = !!heroImageUrl;
  const isTextOnly = !hasHeroImage && !canPlayVideo && !hasAudio;

  // Button navigation between posts
  const [slideDirection, setSlideDirection] = useState<"next" | "prev" | null>(null);

  const currentIndex = allEntries ? allEntries.findIndex((e) => e.id === entry.id) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = allEntries ? currentIndex < allEntries.length - 1 : false;

  const navigateTo = useCallback((direction: "next" | "prev") => {
    if (!allEntries || !onNavigate) return;
    const targetIndex = direction === "next" ? currentIndex + 1 : currentIndex - 1;
    if (targetIndex < 0 || targetIndex >= allEntries.length) return;

    setSlideDirection(direction);
    setTimeout(() => {
      onNavigate(allEntries[targetIndex]);
      setSlideDirection(null);
    }, 150);
  }, [allEntries, currentIndex, onNavigate]);

  // Back button closes detail view
  const closedByBackRef = useRef(false);
  const pushedStateRef = useRef(false);

  useEffect(() => {
    // Push a history entry so back button closes the detail view
    window.history.pushState({ detailView: true }, "");
    pushedStateRef.current = true;

    const handlePopState = () => {
      closedByBackRef.current = true;
      onClose();
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      // If closing via X button (not back button), pop the state we pushed
      if (pushedStateRef.current && !closedByBackRef.current) {
        window.history.back();
      }
    };
  }, [onClose]);

  // Swipe gesture for post navigation
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;

    // Only trigger if horizontal swipe is dominant and > 60px
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0 && hasNext) {
        navigateTo("next");
      } else if (dx > 0 && hasPrev) {
        navigateTo("prev");
      }
    }
  }, [hasNext, hasPrev, navigateTo]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/10 backdrop-blur-[15px] overflow-y-auto"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between p-3 bg-white border-b border-stone-200">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
        {/* Position counter */}
        {allEntries && allEntries.length > 1 && (
          <span className="text-xs text-stone-400 font-medium">
            {currentIndex + 1} / {allEntries.length}
          </span>
        )}
        <div className="flex items-center gap-1">
          {onToggleFavorite && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleFavorite}
              title={isFavorited ? "Remove from favourites" : "Add to favourites"}
            >
              <Heart className={`h-4 w-4 ${isFavorited ? "fill-rose-400 text-rose-400" : ""}`} />
            </Button>
          )}
          {canEdit && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  onEdit(entry);
                  onClose();
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  onDelete(entry.id);
                  onClose();
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Content with slide animation */}
      <div
        className={`transition-transform duration-150 ease-out ${
          slideDirection === "next" ? "-translate-x-full opacity-0" :
          slideDirection === "prev" ? "translate-x-full opacity-0" : ""
        }`}
      >
        <div className="mx-3 mt-3 mb-3 p-5 space-y-4 rounded-xl bg-white border border-stone-200 shadow-lg shadow-black/[0.05]">
          {/* Header metadata (LTR) */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-400">
              {format(new Date(entry.date), "MMM d, yyyy")}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-stone-500">{babyName}</span>
              {babyDob && (
                <Badge variant="secondary" className="text-xs bg-white/70 text-stone-500 border-0">
                  {formatAgeAtDate(babyDob, entry.date)}
                </Badge>
              )}
            </div>
          </div>

          {/* Full text (auto-direction) */}
          {entry.description && (
            <div
              dir="auto"
              className={`leading-relaxed text-zinc-800 ${isTextOnly ? "text-lg" : "text-base"} ${
                isDialogue
                  ? "border-r-2 border-amber-300/60 pr-3 rounded-l-md py-2"
                  : ""
              }`}
            >
              {isDialogue
                ? parseDialogueText(entry.description)
                : <p className="whitespace-pre-wrap">{entry.description}</p>
              }
            </div>
          )}

          {/* Visual media section */}
          {(() => {
            const albumImages: { id: string; url: string }[] = [];
            if (hasHeroImage && !canPlayVideo) {
              albumImages.push({ id: "hero", url: heroImageUrl! });
            }
            if (entry.entry_images) {
              for (const img of [...entry.entry_images].sort((a, b) => a.sort_order - b.sort_order)) {
                const imgUrl = img.thumbnail_url
                  || (img.drive_file_id ? driveStreamUrl(img.drive_file_id) : null);
                if (imgUrl) {
                  albumImages.push({ id: img.id, url: imgUrl });
                }
              }
            }

            if (canPlayVideo) {
              return (
                <div className="-mx-5 mt-2">
                  <DetailVideoPlayer
                    fileId={entry.drive_file_id!}
                    thumbnailUrl={entry.thumbnail_url}
                  />
                  {albumImages.length > 0 && <ImageAlbum images={albumImages} />}
                </div>
              );
            }

            if (albumImages.length > 0) {
              return (
                <div className="-mx-5 mt-2">
                  <ImageAlbum images={albumImages} />
                </div>
              );
            }

            return null;
          })()}

          {/* Audio player */}
          {hasAudio && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-stone-50">
              <Mic className="h-4 w-4 text-muted-foreground shrink-0" />
              <audio controls src={audioUrl!} className="w-full h-8" preload="metadata" />
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t">
            {entry.created_by_nickname && (
              <p className="text-xs text-stone-400">
                Added by {entry.created_by_nickname}
              </p>
            )}
            {!entry.created_by_nickname && <div />}
            {entry.entry_tags.length > 0 && (
              <div className="flex flex-wrap gap-1 justify-end">
                {entry.entry_tags.map((et) => (
                  <Badge
                    key={et.tag_id}
                    variant="secondary"
                    className="text-xs"
                    style={{
                      backgroundColor: `${et.tags.color}20`,
                      color: et.tags.color || undefined,
                    }}
                  >
                    {et.tags.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ImageAlbum({ images }: { images: { id: string; url: string }[] }) {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div className="relative">
      {/* Single image display */}
      <img
        src={images[activeIndex].url}
        alt=""
        className="w-full max-h-[70vh] object-contain"
      />
      {/* Chevron buttons */}
      {images.length > 1 && activeIndex > 0 && (
        <button
          className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/20 backdrop-blur text-white"
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          onClick={() => setActiveIndex((i) => i - 1)}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      {images.length > 1 && activeIndex < images.length - 1 && (
        <button
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/20 backdrop-blur text-white"
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          onClick={() => setActiveIndex((i) => i + 1)}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}
      {/* Dot indicators */}
      {images.length > 1 && (
        <div className="flex justify-center gap-1.5 py-2">
          {images.map((img, i) => (
            <div
              key={img.id}
              className={`h-1.5 rounded-full transition-all ${
                i === activeIndex ? "w-4 bg-foreground" : "w-1.5 bg-foreground/25"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DetailVideoPlayer({
  fileId,
  thumbnailUrl,
}: {
  fileId: string;
  thumbnailUrl: string | null;
}) {
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!started) return;

    (() => {
      try {
        console.log("[DetailVideoPlayer] Building stream URL for:", fileId);
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        // Edge function deployed with --no-verify-jwt; browser can fetch directly
        const url = `${supabaseUrl}/functions/v1/drive-stream?fileId=${encodeURIComponent(fileId)}`;
        setStreamUrl(url);
        console.log("[DetailVideoPlayer] Stream URL ready:", url);
      } catch (e: any) {
        console.error("[DetailVideoPlayer] Error:", e);
        setError(e.message);
      }
    })();
  }, [fileId, started]);

  if (!started) {
    return (
      <div
        className="relative w-full bg-black flex items-center justify-center cursor-pointer"
        style={{ minHeight: "200px" }}
        onClick={() => setStarted(true)}
      >
        {thumbnailUrl && (
          <img
            src={thumbnailUrl}
            alt="Video thumbnail"
            className="w-full max-h-[60vh] object-contain"
          />
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center">
            <div className="w-0 h-0 border-l-[24px] border-l-white border-y-[14px] border-y-transparent ml-1" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full bg-black flex items-center justify-center py-12">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    );
  }

  if (!streamUrl) {
    return (
      <div className="w-full bg-black flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="w-full bg-black flex items-center justify-center">
      <video
        src={streamUrl}
        className="w-full max-h-[60vh]"
        controls
        autoPlay
        playsInline
      />
    </div>
  );
}
