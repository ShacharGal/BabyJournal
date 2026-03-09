import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEntries, useDeleteEntry, type EntryWithTags } from "@/hooks/useEntries";
import { useBabies } from "@/hooks/useBabies";
import { toast } from "@/hooks/use-toast";
import { format, differenceInMonths, differenceInYears, differenceInDays } from "date-fns";
import {
  Loader2, Image, Video, Mic, FileText, Trash2, Users, Heart, Pencil, X, Play, ChevronLeft, ChevronRight, Calendar,
} from "lucide-react";
import { useAuthContext } from "@/contexts/AuthContext";
import type { Filters } from "@/components/SearchFilters";
import { supabase } from "@/integrations/supabase/client";

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

const typeIcons = {
  photo: Image,
  video: Video,
  audio: Mic,
  text: FileText,
};

interface MemoryFeedProps {
  babyId?: string;
  filters: Filters;
  onEditEntry?: (entry: EntryWithTags) => void;
}

export function MemoryFeed({ babyId, filters, onEditEntry }: MemoryFeedProps) {
  const {
    data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage,
  } = useEntries(babyId);
  const { data: babies } = useBabies();
  const deleteEntry = useDeleteEntry();
  const { canEdit } = useAuthContext();
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [videoFileId, setVideoFileId] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState<string>("");
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const monthRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const allEntries = data?.pages.flat() ?? [];

  const filteredEntries = allEntries.filter((entry) => {
    if (filters.text) {
      const s = filters.text.toLowerCase();
      const matchesText =
        entry.description?.toLowerCase().includes(s) ||
        entry.entry_tags.some((et) => et.tags.name.toLowerCase().includes(s));
      if (!matchesText) return false;
    }
    if (filters.tagIds.length > 0) {
      const entryTagIds = entry.entry_tags.map((et) => et.tag_id);
      if (!filters.tagIds.some((id) => entryTagIds.includes(id))) return false;
    }
    if (filters.dateFrom && entry.date < filters.dateFrom) return false;
    if (filters.dateTo && entry.date > filters.dateTo) return false;
    return true;
  });

  // Group entries by month key (YYYY-MM)
  const groupedEntries = useMemo(() => {
    const groups: { key: string; label: string; entries: EntryWithTags[] }[] = [];
    let currentKey = "";
    for (const entry of filteredEntries) {
      const key = entry.date.slice(0, 7); // YYYY-MM
      if (key !== currentKey) {
        currentKey = key;
        const d = new Date(key + "-01");
        groups.push({ key, label: format(d, "MMMM yyyy"), entries: [] });
      }
      groups[groups.length - 1].entries.push(entry);
    }
    return groups;
  }, [filteredEntries]);

  // Track which month is visible via IntersectionObserver
  const monthObserverRef = useRef<IntersectionObserver | null>(null);
  const setMonthRef = useCallback((key: string, el: HTMLDivElement | null) => {
    if (el) {
      monthRefs.current.set(key, el);
    } else {
      monthRefs.current.delete(key);
    }
  }, []);

  useEffect(() => {
    if (monthObserverRef.current) monthObserverRef.current.disconnect();

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the topmost visible month divider
        for (const e of entries) {
          if (e.isIntersecting) {
            const key = (e.target as HTMLElement).dataset.month;
            if (key) setCurrentMonth(key);
          }
        }
      },
      { rootMargin: "-60px 0px -80% 0px" }
    );
    monthObserverRef.current = observer;

    monthRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [groupedEntries]);

  // Set initial month
  useEffect(() => {
    if (!currentMonth && groupedEntries.length > 0) {
      setCurrentMonth(groupedEntries[0].key);
    }
  }, [groupedEntries, currentMonth]);

  const scrollToMonth = (key: string) => {
    const el = monthRefs.current.get(key);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setMonthPickerOpen(false);
    }
  };

  const currentMonthLabel = groupedEntries.find((g) => g.key === currentMonth)?.label || "";

  const handleDelete = (entryId: string) => {
    if (confirm("Are you sure you want to delete this memory?")) {
      deleteEntry.mutate(entryId, {
        onSuccess: () => toast({ title: "Deleted", description: "Memory has been removed." }),
        onError: (error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
      });
    }
  };

  const getBabyName = (id: string) => babies?.find((b) => b.id === id)?.name || "Unknown";
  const getBabyDob = (id: string) => babies?.find((b) => b.id === id)?.date_of_birth || null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (filteredEntries.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <Heart className="h-12 w-12 mx-auto mb-4 opacity-20" />
        <p className="text-lg font-medium">
          {filters.text || filters.tagIds.length > 0 || filters.dateFrom || filters.dateTo
            ? "No memories match your filters"
            : "No memories yet"}
        </p>
        <p className="text-sm mt-1">
          {filters.text || filters.tagIds.length > 0
            ? "Try different filters"
            : "Tap + to add your first memory"}
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Sticky month/year header */}
      {filteredEntries.length > 0 && (
        <div className="sticky top-14 z-30 flex items-center justify-center py-1.5 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <button
            onClick={() => setMonthPickerOpen(!monthPickerOpen)}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1 rounded-full hover:bg-accent"
          >
            <Calendar className="h-3.5 w-3.5" />
            {currentMonthLabel}
          </button>
        </div>
      )}

      {/* Month picker dropdown */}
      {monthPickerOpen && (
        <div className="sticky top-[6.5rem] z-30 flex justify-center">
          <div className="bg-popover border rounded-lg shadow-lg p-2 max-h-64 overflow-y-auto w-48">
            {groupedEntries.map((group) => (
              <button
                key={group.key}
                onClick={() => scrollToMonth(group.key)}
                className={`w-full text-left text-sm px-3 py-1.5 rounded hover:bg-accent transition-colors ${group.key === currentMonth ? "bg-accent font-medium" : ""}`}
              >
                {group.label}
                <span className="text-muted-foreground ml-1 text-xs">({group.entries.length})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {groupedEntries.map((group) => (
          <div key={group.key}>
            <div
              ref={(el) => setMonthRef(group.key, el)}
              data-month={group.key}
              className="scroll-mt-24"
            />
            {group.entries.map((entry) => (
              <div key={entry.id} className="mb-4">
                <MemoryCard
                  entry={entry}
                  babyName={getBabyName(entry.baby_id)}
                  babyDob={getBabyDob(entry.baby_id)}
                  onDelete={handleDelete}
                  onEdit={onEditEntry}
                  showBaby={!babyId}
                  canEdit={canEdit}
                  onImageTap={setLightboxUrl}
                  onVideoTap={setVideoFileId}
                />
              </div>
            ))}
          </div>
        ))}
        <div ref={sentinelRef} className="h-1" />
        {isFetchingNextPage && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxUrl(null)}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/20"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="h-6 w-6" />
          </Button>
          <img
            src={lightboxUrl}
            alt="Full size"
            className="max-h-[90vh] max-w-[95vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {videoFileId && (
        <VideoPlayer fileId={videoFileId} onClose={() => setVideoFileId(null)} />
      )}
    </>
  );
}

function VideoPlayer({ fileId, onClose }: { fileId: string; onClose: () => void }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let revoke: string | null = null;

    (async () => {
      try {
        console.log("[VideoPlayer] Fetching video:", fileId);
        // Get access token via edge function
        const { data: { session } } = await supabase.auth.getSession();
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        const tokenRes = await fetch(`${supabaseUrl}/functions/v1/drive-upload`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token ?? supabaseKey}`,
            "apikey": supabaseKey,
          },
          body: JSON.stringify({ action: "get-token" }),
        });
        const tokenBody = await tokenRes.json();
        if (!tokenRes.ok) throw new Error(tokenBody?.error || "Failed to get token");

        // Fetch video from Google Drive API
        const videoRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
          { headers: { Authorization: `Bearer ${tokenBody.accessToken}` } }
        );
        if (!videoRes.ok) throw new Error(`Drive download failed: ${videoRes.status}`);

        const blob = await videoRes.blob();
        const url = URL.createObjectURL(blob);
        revoke = url;
        setBlobUrl(url);
        console.log("[VideoPlayer] Video ready, size:", (blob.size / 1024 / 1024).toFixed(1), "MB");
      } catch (e: any) {
        console.error("[VideoPlayer] Error:", e);
        setError(e.message);
      }
    })();

    return () => {
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [fileId]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 z-10 text-white hover:bg-white/20"
        onClick={onClose}
      >
        <X className="h-6 w-6" />
      </Button>
      {error ? (
        <p className="text-red-400 text-sm">{error}</p>
      ) : !blobUrl ? (
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      ) : (
        <video
          src={blobUrl}
          className="w-[95vw] max-w-3xl max-h-[90vh] rounded-lg"
          controls
          autoPlay
          playsInline
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </div>
  );
}

interface MemoryCardProps {
  entry: EntryWithTags;
  babyName: string;
  babyDob: string | null;
  onDelete: (id: string) => void;
  onEdit?: (entry: EntryWithTags) => void;
  showBaby: boolean;
  canEdit: boolean;
  onImageTap: (url: string) => void;
  onVideoTap: (driveFileId: string) => void;
}

function MemoryCard({ entry, babyName, babyDob, onDelete, onEdit, showBaby, canEdit, onImageTap, onVideoTap }: MemoryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const TypeIcon = typeIcons[entry.type as keyof typeof typeIcons] || FileText;
  const descriptionLong = (entry.description?.length ?? 0) > 200;
  const audioUrl = (entry as any).audio_url as string | null;
  const audioFileName = (entry as any).audio_file_name as string | null;
  const hasAudio = !!audioUrl;
  const hasThumbnail = !!entry.thumbnail_url;
  const isVideo = entry.type === "video";
  const canPlayVideo = isVideo && !!entry.drive_file_id;

  const handleThumbnailTap = () => {
    if (canPlayVideo) {
      onVideoTap(entry.drive_file_id!);
    } else if (entry.thumbnail_url) {
      onImageTap(entry.thumbnail_url);
    }
  };

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      {/* Thumbnail image (with play overlay for playable videos) */}
      {hasThumbnail && (
        <div
          className="relative w-full aspect-square overflow-hidden cursor-pointer"
          onClick={handleThumbnailTap}
        >
          <img
            src={entry.thumbnail_url}
            alt={entry.description || "Memory"}
            className="w-full h-full object-cover"
          />
          {canPlayVideo && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center">
                <Play className="h-8 w-8 text-white ml-1" fill="white" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Video without thumbnail (old entries) */}
      {!hasThumbnail && canPlayVideo && (
        <div
          className="w-full bg-gradient-to-br from-primary/10 to-primary/5 flex flex-col items-center justify-center py-8 gap-2 cursor-pointer"
          onClick={() => onVideoTap(entry.drive_file_id!)}
        >
          <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center">
            <Play className="h-7 w-7 text-primary ml-0.5" fill="currentColor" />
          </div>
          <span className="text-xs text-muted-foreground">Tap to play video</span>
        </div>
      )}

      {/* Audio-only banner (no photo/video) */}
      {!hasThumbnail && !isVideo && hasAudio && (
        <div className="w-full bg-gradient-to-br from-primary/10 to-primary/5 flex flex-col items-center justify-center py-8 gap-2">
          <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center">
            <Mic className="h-7 w-7 text-primary" />
          </div>
          <span className="text-xs text-muted-foreground">{audioFileName || "Audio clip"}</span>
        </div>
      )}

      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <TypeIcon className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium">
              {format(new Date(entry.date), "MMM d, yyyy")}
            </span>
            {babyDob && (
              <Badge variant="secondary" className="text-xs">
                {formatAgeAtDate(babyDob, entry.date)}
              </Badge>
            )}
            {showBaby && (
              <Badge variant="outline" className="text-xs">
                <Users className="h-3 w-3 mr-1" />
                {babyName}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {canEdit && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit?.(entry)}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {canEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => onDelete(entry.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {entry.description && (
          <div>
            <p dir="auto" className={`text-sm whitespace-pre-wrap ${!expanded && descriptionLong ? "line-clamp-4" : ""}`}>
              {entry.description}
            </p>
            {descriptionLong && (
              <button
                className="text-xs text-muted-foreground mt-1 hover:underline"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? "Show less" : "See more..."}
              </button>
            )}
          </div>
        )}

        {/* Inline audio player */}
        {hasAudio && (
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-2">
            <Mic className="h-4 w-4 text-muted-foreground shrink-0" />
            <audio controls src={audioUrl!} className="w-full h-8" preload="metadata" />
          </div>
        )}

        {entry.created_by_nickname && (
          <p className="text-xs text-muted-foreground">
            Added by {entry.created_by_nickname}
          </p>
        )}

        {entry.entry_tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
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
  );
}

