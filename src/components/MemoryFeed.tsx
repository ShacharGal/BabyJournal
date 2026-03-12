import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEntries, useDeleteEntry, type EntryWithTags } from "@/hooks/useEntries";
import { useBabies } from "@/hooks/useBabies";
import { toast } from "@/hooks/use-toast";
import { format, differenceInMonths, differenceInYears, differenceInDays } from "date-fns";
import {
  Loader2, Heart, Calendar, Volume2, ChevronLeft, ChevronRight, User,
} from "lucide-react";
import { useAuthContext } from "@/contexts/AuthContext";
import type { Filters } from "@/components/SearchFilters";
import { MemoryDetailView } from "@/components/MemoryDetailView";
import { parseDialogueText } from "@/lib/dialogueParser";
import { driveStreamUrl } from "@/lib/driveStreamUrl";
import { useFavoriteIds, useToggleFavorite } from "@/hooks/useFavorites";

const EARTH_TONE_COLORS = [
  "#e27a47", // Rust
  "#848252", // Olive
  "#7197d3", // Denim
  "#cb857a", // Dusty Rose
  "#8da38c", // Sage Green
  "#cba358", // Ochre
  "#9c7a8b", // Mauve
];

function getTagColor(tagName: string): string {
  let hash = 0;
  for (let i = 0; i < tagName.length; i++) {
    hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return EARTH_TONE_COLORS[Math.abs(hash) % EARTH_TONE_COLORS.length];
}

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
  const { canEdit, canAdd, user } = useAuthContext();
  const { data: favoriteIds = new Set<string>() } = useFavoriteIds(user?.id);
  const toggleFavorite = useToggleFavorite();
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

  // Calendar grid: available years and months with entries
  const monthsWithEntries = useMemo(() => {
    const set = new Set<string>();
    for (const entry of filteredEntries) {
      set.add(entry.date.slice(0, 7)); // YYYY-MM
    }
    return set;
  }, [filteredEntries]);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    for (const key of monthsWithEntries) {
      years.add(parseInt(key.slice(0, 4)));
    }
    return Array.from(years).sort((a, b) => b - a); // newest first
  }, [monthsWithEntries]);

  const [calendarYear, setCalendarYear] = useState<number>(() => {
    if (currentMonth) return parseInt(currentMonth.slice(0, 4));
    return new Date().getFullYear();
  });

  // Sync calendar year when currentMonth changes from scrolling
  useEffect(() => {
    if (currentMonth) {
      setCalendarYear(parseInt(currentMonth.slice(0, 4)));
    }
  }, [currentMonth]);

  const calendarYearIndex = availableYears.indexOf(calendarYear);
  const canGoPrevYear = calendarYearIndex < availableYears.length - 1;
  const canGoNextYear = calendarYearIndex > 0;

  const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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
        <div className="sticky top-14 z-30 flex items-center justify-center py-1.5 pointer-events-none">
          <button
            onClick={() => setMonthPickerOpen(!monthPickerOpen)}
            className="pointer-events-auto flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1 rounded-full bg-white/70 backdrop-blur-[12px] border border-white/80 shadow-sm hover:bg-white/90"
          >
            <Calendar className="h-3.5 w-3.5" />
            {currentMonthLabel}
          </button>
        </div>
      )}

      {/* Calendar grid picker */}
      {monthPickerOpen && (
        <div className="sticky top-[6.5rem] z-30 flex justify-center">
          <div className="bg-white/70 backdrop-blur-[12px] border border-white/80 rounded-lg shadow-lg p-3 w-64">
            {/* Year selector with arrows */}
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => canGoPrevYear && setCalendarYear(availableYears[calendarYearIndex + 1])}
                disabled={!canGoPrevYear}
                className="p-1 rounded hover:bg-accent disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold">{calendarYear}</span>
              <button
                onClick={() => canGoNextYear && setCalendarYear(availableYears[calendarYearIndex - 1])}
                disabled={!canGoNextYear}
                className="p-1 rounded hover:bg-accent disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            {/* 4x3 month grid */}
            <div className="grid grid-cols-4 gap-1">
              {MONTH_LABELS.map((label, i) => {
                const monthKey = `${calendarYear}-${String(i + 1).padStart(2, "0")}`;
                const hasEntries = monthsWithEntries.has(monthKey);
                const isCurrent = monthKey === currentMonth;
                return (
                  <button
                    key={monthKey}
                    onClick={() => {
                      if (hasEntries) scrollToMonth(monthKey);
                    }}
                    disabled={!hasEntries}
                    className={`py-1.5 rounded text-xs transition-colors ${
                      isCurrent
                        ? "bg-foreground text-background font-bold"
                        : hasEntries
                          ? "font-semibold text-foreground hover:bg-accent"
                          : "text-muted-foreground/40 cursor-not-allowed"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
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
                  isFavorited={favoriteIds.has(entry.id)}
                  onToggleFavorite={(entryId) => {
                    if (!user?.id) return;
                    toggleFavorite.mutate({ entryId, userId: user.id, isFavorited: favoriteIds.has(entryId) });
                  }}
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
          canEdit={canEdit || (canAdd && !!user && detailEntry.created_by === user.id)}
          onClose={() => setDetailEntry(null)}
          onEdit={(entry) => {
            setDetailEntry(null);
            onEditEntry?.(entry);
          }}
          onDelete={(id) => {
            setDetailEntry(null);
            handleDelete(id);
          }}
          isFavorited={favoriteIds.has(detailEntry.id)}
          onToggleFavorite={() => {
            if (!user?.id) return;
            toggleFavorite.mutate({ entryId: detailEntry.id, userId: user.id, isFavorited: favoriteIds.has(detailEntry.id) });
          }}
          allEntries={filteredEntries}
          onNavigate={setDetailEntry}
        />
      )}
    </>
  );
}

/* ──────────────────────────────────────────────────────────────── */
/*  MemoryCard — Text-First Feed Card                              */
/* ──────────────────────────────────────────────────────────────── */

export interface MemoryCardProps {
  entry: EntryWithTags;
  babyName: string;
  babyDob: string | null;
  showBaby: boolean;
  onExpand: (entry: EntryWithTags) => void;
  isFavorited?: boolean;
  onToggleFavorite?: (entryId: string) => void;
}

export function MemoryCard({ entry, babyName, babyDob, showBaby, onExpand, isFavorited = false, onToggleFavorite }: MemoryCardProps) {
  const audioUrl = (entry as any).audio_url as string | null;
  const hasThumbnail = !!entry.thumbnail_url;
  const isPhoto = entry.type === "photo";
  const isVideo = entry.type === "video";
  const hasAudio = !!audioUrl;
  const isDialogue = (entry as any).post_type === "dialogue";

  // Fallback: if no thumbnail but has drive_file_id and is a photo, use drive-stream
  const displayImageUrl = entry.thumbnail_url
    || (isPhoto && entry.drive_file_id ? driveStreamUrl(entry.drive_file_id) : null);

  // Determine body scenario
  const hasMedia = !!displayImageUrl || (isVideo && !!entry.drive_file_id);
  const hasAudioOnly = !hasMedia && hasAudio;
  const showSplit = hasMedia || hasAudioOnly;

  return (
    <div
      className="rounded-xl border border-white/80 bg-white/45 backdrop-blur-[12px] text-card-foreground shadow-lg shadow-black/[0.05] overflow-hidden cursor-pointer active:scale-[0.99] transition-transform"
      onClick={() => onExpand(entry)}
    >
      {/* Header (LTR): Date left, Name + Age right */}
      <div className="flex items-center justify-between px-6 pt-5 pb-1">
        <span className="text-[11px] font-medium text-stone-400">
          {format(new Date(entry.date), "MMM d, yyyy")}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium text-stone-500">{babyName}</span>
          {babyDob && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-white/70 text-stone-500 border-0">
              {formatAgeAtDate(babyDob, entry.date)}
            </Badge>
          )}
        </div>
      </div>

      {/* Body: optional media (left) + text (right) */}
      <div className={`px-6 py-4 ${showSplit ? "flex gap-3" : ""}`}>
        {/* Media container — left side, 35% width */}
        {hasMedia && (
          <div className="w-[35%] shrink-0">
            <div className="relative w-full overflow-hidden rounded-lg" style={{ aspectRatio: "4/5" }}>
              {displayImageUrl ? (
                <img
                  src={displayImageUrl}
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
              {isVideo && displayImageUrl && (
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
          className={`${showSplit ? "flex-1 min-w-0" : "w-full"}`}
        >
          {entry.description ? (
            <div
              dir="auto"
              className={`text-sm text-[#353326] whitespace-pre-wrap line-clamp-5 ${
                isDialogue
                  ? "border-r-2 border-amber-300/60 pr-2 rounded-l-md py-1"
                  : ""
              }`}
            >
              {isDialogue
                ? parseDialogueText(entry.description)
                : entry.description
              }
            </div>
          ) : (
            <div className="text-sm text-[#57534e]">No description</div>
          )}
        </div>
      </div>

      {/* Footer: LTR left (expand + contributor) — RTL right (tags) */}
      <div className="flex items-center justify-between px-6 pb-5 pt-1 gap-2">
        {/* Left side (LTR): Expand icon + heart + contributor */}
        <div className="flex items-center gap-2 text-stone-400 shrink-0">
          {onToggleFavorite && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(entry.id); }}
              className="p-1 hover:text-rose-400 transition-colors"
              title={isFavorited ? "Remove from favourites" : "Add to favourites"}
            >
              <Heart className={`h-3.5 w-3.5 ${isFavorited ? "fill-rose-400 text-rose-400" : ""}`} />
            </button>
          )}
          {entry.created_by_nickname && (
            <div className="flex items-center gap-1 text-xs">
              <User className="h-3.5 w-3.5" />
              <span>{entry.created_by_nickname}</span>
            </div>
          )}
        </div>
        {/* Right side (RTL): Tags */}
        {entry.entry_tags.length > 0 && (
          <div className="flex flex-wrap gap-1 justify-end min-w-0">
            {entry.entry_tags.map((et) => {
              const bgColor = getTagColor(et.tags.name);
              return (
                <Badge
                  key={et.tag_id}
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 font-medium border-0"
                  style={{
                    backgroundColor: bgColor,
                    color: "#ffffff",
                  }}
                >
                  {et.tags.name}
                </Badge>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
