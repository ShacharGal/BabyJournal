import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEntries, useDeleteEntry, type EntryWithTags } from "@/hooks/useEntries";
import { useBabies } from "@/hooks/useBabies";
import { toast } from "@/hooks/use-toast";
import { format, differenceInMonths, differenceInYears, differenceInDays } from "date-fns";
import {
  Loader2,
  Image,
  Video,
  Mic,
  FileText,
  Trash2,
  ExternalLink,
  Calendar,
  Users,
  Heart,
} from "lucide-react";
import { useAuthContext } from "@/contexts/AuthContext";

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
  search: string;
}

export function MemoryFeed({ babyId, search }: MemoryFeedProps) {
  const { data: entries, isLoading } = useEntries(babyId);
  const { data: babies } = useBabies();
  const deleteEntry = useDeleteEntry();
  const { canEdit } = useAuthContext();

  const filteredEntries = entries?.filter((entry) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      entry.description?.toLowerCase().includes(s) ||
      entry.file_name?.toLowerCase().includes(s) ||
      entry.entry_tags.some((et) => et.tags.name.toLowerCase().includes(s))
    );
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

  if (!filteredEntries || filteredEntries.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <Heart className="h-12 w-12 mx-auto mb-4 opacity-20" />
        <p className="text-lg font-medium">
          {search ? "No memories match your search" : "No memories yet"}
        </p>
        <p className="text-sm mt-1">
          {search ? "Try a different search term" : "Tap + to add your first memory"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {filteredEntries.map((entry) => (
        <MemoryCard
          key={entry.id}
          entry={entry}
          babyName={getBabyName(entry.baby_id)}
          babyDob={getBabyDob(entry.baby_id)}
          onDelete={handleDelete}
          showBaby={!babyId}
          canEdit={canEdit}
        />
      ))}
    </div>
  );
}

interface MemoryCardProps {
  entry: EntryWithTags;
  babyName: string;
  babyDob: string | null;
  onDelete: (id: string) => void;
  showBaby: boolean;
  canEdit: boolean;
}

function MemoryCard({ entry, babyName, babyDob, onDelete, showBaby, canEdit }: MemoryCardProps) {
  const TypeIcon = typeIcons[entry.type as keyof typeof typeIcons] || FileText;

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      {/* Thumbnail */}
      {entry.thumbnail_url && (
        <img
          src={entry.thumbnail_url}
          alt={entry.description || "Memory"}
          className="w-full h-56 object-cover"
        />
      )}

      <div className="p-4 space-y-3">
        {/* Header row */}
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
            {entry.drive_file_id && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() =>
                  window.open(
                    `https://drive.google.com/file/d/${entry.drive_file_id}/view`,
                    "_blank"
                  )
                }
              >
                <ExternalLink className="h-4 w-4" />
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

        {/* Description */}
        {entry.description && (
          <p className="text-sm">{entry.description}</p>
        )}

        {/* File name */}
        {entry.file_name && (
          <p className="text-xs text-muted-foreground">{entry.file_name}</p>
        )}

        {/* Tags */}
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
