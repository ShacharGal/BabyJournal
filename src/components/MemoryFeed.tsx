import { useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEntries, useDeleteEntry, type EntryWithTags } from "@/hooks/useEntries";
import { useBabies } from "@/hooks/useBabies";
import { toast } from "@/hooks/use-toast";
import { format, differenceInMonths, differenceInYears, differenceInDays } from "date-fns";
import {
  Loader2, Image, Video, Mic, FileText, Trash2, Users, Heart, Pencil, X,
} from "lucide-react";
import { useAuthContext } from "@/contexts/AuthContext";
import type { Filters } from "@/components/SearchFilters";

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
    // Text filter
    if (filters.text) {
      const s = filters.text.toLowerCase();
      const matchesText =
        entry.description?.toLowerCase().includes(s) ||
        entry.entry_tags.some((et) => et.tags.name.toLowerCase().includes(s));
      if (!matchesText) return false;
    }
    // Tag filter
    if (filters.tagIds.length > 0) {
      const entryTagIds = entry.entry_tags.map((et) => et.tag_id);
      if (!filters.tagIds.some((id) => entryTagIds.includes(id))) return false;
    }
    // Date range
    if (filters.dateFrom && entry.date < filters.dateFrom) return false;
    if (filters.dateTo && entry.date > filters.dateTo) return false;
    return true;
  });

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
      <div className="space-y-4">
        {filteredEntries.map((entry) => (
          <MemoryCard
            key={entry.id}
            entry={entry}
            babyName={getBabyName(entry.baby_id)}
            babyDob={getBabyDob(entry.baby_id)}
            onDelete={handleDelete}
            onEdit={onEditEntry}
            showBaby={!babyId}
            canEdit={canEdit}
            onImageTap={setLightboxUrl}
          />
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
    </>
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
}

function MemoryCard({ entry, babyName, babyDob, onDelete, onEdit, showBaby, canEdit, onImageTap }: MemoryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const TypeIcon = typeIcons[entry.type as keyof typeof typeIcons] || FileText;
  const descriptionLong = (entry.description?.length ?? 0) > 200;

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      {entry.thumbnail_url && (
        <div
          className="w-full aspect-square overflow-hidden cursor-pointer"
          onClick={() => onImageTap(entry.thumbnail_url!)}
        >
          <img
            src={entry.thumbnail_url}
            alt={entry.description || "Memory"}
            className="w-full h-full object-cover"
          />
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
            <p className={`text-sm whitespace-pre-wrap ${!expanded && descriptionLong ? "line-clamp-4" : ""}`}>
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
