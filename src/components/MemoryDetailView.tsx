import { useState, useEffect, useRef, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Pencil, Trash2, Loader2, Mic, Volume2 } from "lucide-react";
import { format, differenceInMonths, differenceInYears, differenceInDays } from "date-fns";
import { parseDialogueText } from "@/lib/dialogueParser";
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
}

export function MemoryDetailView({
  entry,
  babyName,
  babyDob,
  canEdit,
  onClose,
  onEdit,
  onDelete,
}: MemoryDetailViewProps) {
  const audioUrl = (entry as any).audio_url as string | null;
  const hasThumbnail = !!entry.thumbnail_url;
  const isVideo = entry.type === "video";
  const canPlayVideo = isVideo && !!entry.drive_file_id;
  const hasAudio = !!audioUrl;
  const isDialogue = (entry as any).post_type === "dialogue";
  const isTextOnly = !hasThumbnail && !canPlayVideo && !hasAudio;

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      {/* Top bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between p-3 bg-background/95 backdrop-blur border-b">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
        {canEdit && (
          <div className="flex items-center gap-1">
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
          </div>
        )}
      </div>

      {/* Media section */}
      {(() => {
        // Build unified album: hero image first, then secondary images
        const albumImages: { id: string; url: string }[] = [];
        if (hasThumbnail && !canPlayVideo) {
          albumImages.push({ id: "hero", url: entry.thumbnail_url! });
        }
        if (entry.entry_images) {
          for (const img of [...entry.entry_images].sort((a, b) => a.sort_order - b.sort_order)) {
            if (img.thumbnail_url) {
              albumImages.push({ id: img.id, url: img.thumbnail_url });
            }
          }
        }

        if (canPlayVideo) {
          // Video gets its own player, secondary images as album below
          return (
            <>
              <DetailVideoPlayer
                fileId={entry.drive_file_id!}
                thumbnailUrl={entry.thumbnail_url}
              />
              {albumImages.length > 0 && <ImageAlbum images={albumImages} />}
            </>
          );
        }

        if (albumImages.length > 0) {
          return <ImageAlbum images={albumImages} />;
        }

        // Audio-only hero
        if (hasAudio) {
          return (
            <div className="w-full bg-gradient-to-br from-primary/10 to-primary/5 flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center">
                <Volume2 className="h-8 w-8 text-primary" />
              </div>
            </div>
          );
        }

        return null;
      })()}

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Header metadata (LTR) */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-500">
            {format(new Date(entry.date), "MMM d, yyyy")}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-zinc-800">{babyName}</span>
            {babyDob && (
              <Badge variant="secondary" className="text-xs">
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

        {/* Audio player */}
        {hasAudio && (
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3">
            <Mic className="h-4 w-4 text-muted-foreground shrink-0" />
            <audio controls src={audioUrl!} className="w-full h-8" preload="metadata" />
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t">
          {entry.created_by_nickname && (
            <p className="text-xs text-zinc-500">
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
  );
}

function ImageAlbum({ images }: { images: { id: string; url: string }[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollLeft = el.scrollLeft;
    const width = el.clientWidth;
    const index = Math.round(scrollLeft / width);
    setActiveIndex(index);
  }, []);

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {images.map((img) => (
          <div key={img.id} className="w-full shrink-0 snap-center">
            <img
              src={img.url}
              alt=""
              className="w-full aspect-square object-cover"
            />
          </div>
        ))}
      </div>
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
