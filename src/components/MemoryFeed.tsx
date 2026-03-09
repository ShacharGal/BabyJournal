import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEntries, useDeleteEntry, type EntryWithTags } from "@/hooks/useEntries";
import { useBabies } from "@/hooks/useBabies";
import { toast } from "@/hooks/use-toast";
import { format, differenceInMonths, differenceInYears, differenceInDays } from "date-fns";
import {
  Loader2, Heart, Calendar, Maximize2, Volume2,
} from "lucide-react";
import { useAuthContext } from "@/contexts/AuthContext";
import type { Filters } from "@/components/SearchFilters";
import { MemoryDetailView } from "@/components/MemoryDetailView";
import { parseDialogueText } from "@/lib/dialogueParser";

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
  const [detailEntry, setDetailEntry] = useState<EntryWithTags | null>(null);
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
        entry.entry_tags.some((et) => et.tags.name.toLowerCase().includes(s)) ||
        entry.created_by_nickname?.toLowerCase().includes(s);
      if (!matchesText) return false;
    }
    if (filters.tagIds.length > 0) {
      const entryTagIds = entry.entry_tags.map((et) => et.tag_id);
      if (!filters.tagIds.some((id) => entryTagIds.includes(id))) return false;
    }
    if (filters.dateFrom && entry.date < filters.dateFrom) return false;
    if (filters.dateTo && entry.date > filters.dateTo) return false;
    if (filters.entryType && entry.type !== filters.entryType) return false;
    if (filters.postType && (entry as any).post_type !== filters.postType) return false;
    if (filters.contributorId && entry.created_by !== filters.contributorId) return false;
    return true;
  });

  const groupedEntries = useMemo(() => {
    const groups: { key: string; label: string; entries: EntryWithTags[] }[] = [];
    let currentKey = "";
    for (const entry of filteredEntries) {
      const key = entry.date.slice(0, 7);
      if (key !== currentKey) {
        currentKey = key;
        const d = new Date(key + "-01");
        groups.push({ key, label: format(d, "MMMM yyyy"), entries: [] });
      }
      groups[groups.length - 1].entries.push(entry);
    }
    return groups;
  }, [filteredEntries]);

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

      <div className="space-y-3">
        {groupedEntries.map((group) => (
          <div key={group.key}>
            <div
              ref={(el) => setMonthRef(group.key, el)}
              data-month={group.key}
              className="scroll-mt-24"
            />
            {group.entries.map((entry) => (
              <div key={entry.id} className="mb-3">
                <MemoryCard
                  entry={entry}
                  babyName={getBabyName(entry.baby_id)}
                  babyDob={getBabyDob(entry.baby_id)}
                  showBaby={!babyId}
                  onExpand={setDetailEntry}
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

      {/* Detail View Modal */}
      {detailEntry && (
        <MemoryDetailView
          entry={detailEntry}
          babyName={getBabyName(detailEntry.baby_id)}
          babyDob={getBabyDob(detailEntry.baby_id)}
          canEdit={canEdit}
          onClose={() => setDetailEntry(null)}
          onEdit={(entry) => {
            setDetailEntry(null);
            onEditEntry?.(entry);
          }}
          onDelete={(id) => {
            setDetailEntry(null);
            handleDelete(id);
          }}
        />
      )}
    </>
  );
}

/* ──────────────────────────────────────────────────────────────── */
/*  MemoryCard — Text-First Feed Card                              */
/* ──────────────────────────────────────────────────────────────── */

interface MemoryCardProps {
  entry: EntryWithTags;
  babyName: string;
  babyDob: string | null;
  showBaby: boolean;
  onExpand: (entry: EntryWithTags) => void;
}

function MemoryCard({ entry, babyName, babyDob, showBaby, onExpand }: MemoryCardProps) {
  const audioUrl = (entry as any).audio_url as string | null;
  const hasThumbnail = !!entry.thumbnail_url;
  const isVideo = entry.type === "video";
  const hasAudio = !!audioUrl;
  const isDialogue = (entry as any).post_type === "dialogue";

  // Determine body scenario
  const hasMedia = hasThumbnail || (isVideo && !!entry.drive_file_id);
  const hasAudioOnly = !hasMedia && hasAudio;
  const showSplit = hasMedia || hasAudioOnly;

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      {/* Header (LTR): Date left, Name + Age right */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <span className="text-xs font-medium text-muted-foreground">
          {format(new Date(entry.date), "MMM d, yyyy")}
        </span>
        <div className="flex items-center gap-1.5">
          {showBaby && (
            <span className="text-xs font-medium">{babyName}</span>
          )}
          {!showBaby && (
            <span className="text-xs font-medium">{babyName}</span>
          )}
          {babyDob && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {formatAgeAtDate(babyDob, entry.date)}
            </Badge>
          )}
        </div>
      </div>

      {/* Body: optional media (left) + text (right) */}
      <div className={`px-4 py-2 ${showSplit ? "flex gap-3" : ""}`}>
        {/* Media container — left side, 35% width */}
        {hasMedia && (
          <div className="w-[35%] shrink-0">
            <div className="relative w-full overflow-hidden rounded-lg" style={{ aspectRatio: "4/5" }}>
              {hasThumbnail ? (
                <img
                  src={entry.thumbnail_url!}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                /* Video without thumbnail */
                <div className="w-full h-full bg-muted flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
                    <div className="w-0 h-0 border-l-[12px] border-l-primary border-y-[7px] border-y-transparent ml-0.5" />
                  </div>
                </div>
              )}
              {/* Video indicator overlay */}
              {isVideo && hasThumbnail && (
                <div className="absolute bottom-1 right-1 bg-black/60 rounded px-1 py-0.5">
                  <span className="text-[9px] text-white font-medium">VIDEO</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Audio-only: icon in place of media (left side) */}
        {hasAudioOnly && (
          <div className="w-[35%] shrink-0">
            <div
              className="w-full overflow-hidden rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center"
              style={{ aspectRatio: "4/5" }}
            >
              <Volume2 className="h-8 w-8 text-primary/60" />
            </div>
          </div>
        )}

        {/* Text container — right side (or full width if no media) */}
        <div
          className={`relative ${showSplit ? "flex-1 min-w-0" : "w-full"}`}
        >
          {entry.description ? (
            <div
              dir="auto"
              className={`text-sm whitespace-pre-wrap line-clamp-5 ${
                isDialogue
                  ? "border-r-2 border-primary/30 pr-2 bg-primary/5 rounded-l-md py-1"
                  : ""
              }`}
            >
              {isDialogue
                ? parseDialogueText(entry.description)
                : entry.description
              }
            </div>
          ) : (
            <div className="text-sm text-muted-foreground italic">No description</div>
          )}

          {/* Expand icon — bottom-left of text area */}
          <button
            onClick={() => onExpand(entry)}
            className="absolute bottom-0 left-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
            title="Expand"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Footer (LTR/RTL mix): Contributor left, Tags right */}
      <div className="flex items-center justify-between px-4 pb-3 pt-1 gap-2">
        <div className="text-xs text-muted-foreground shrink-0">
          {entry.created_by_nickname ? `Added by ${entry.created_by_nickname}` : "\u00A0"}
        </div>
        {entry.entry_tags.length > 0 && (
          <div className="flex flex-wrap gap-1 justify-end min-w-0">
            {entry.entry_tags.map((et) => (
              <Badge
                key={et.tag_id}
                variant="secondary"
                className="text-[10px] px-1.5 py-0"
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
