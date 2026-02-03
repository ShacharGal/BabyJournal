import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEntries, useDeleteEntry, type EntryWithTags } from "@/hooks/useEntries";
import { useBabies } from "@/hooks/useBabies";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { 
  Search, 
  Loader2, 
  Image, 
  Video, 
  Mic, 
  FileText, 
  Trash2,
  ExternalLink,
  Calendar,
  Baby
} from "lucide-react";

const typeIcons = {
  photo: Image,
  video: Video,
  audio: Mic,
  text: FileText,
};

const typeColors = {
  photo: "bg-blue-500/10 text-blue-600",
  video: "bg-purple-500/10 text-purple-600",
  audio: "bg-orange-500/10 text-orange-600",
  text: "bg-green-500/10 text-green-600",
};

interface EntryListProps {
  babyId?: string;
}

export function EntryList({ babyId }: EntryListProps) {
  const [search, setSearch] = useState("");
  const { data: entries, isLoading } = useEntries(babyId);
  const { data: babies } = useBabies();
  const deleteEntry = useDeleteEntry();

  const filteredEntries = entries?.filter((entry) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      entry.description?.toLowerCase().includes(searchLower) ||
      entry.file_name?.toLowerCase().includes(searchLower) ||
      entry.entry_tags.some(et => 
        et.tags.name.toLowerCase().includes(searchLower)
      )
    );
  });

  const handleDelete = (entryId: string) => {
    if (confirm("Are you sure you want to delete this memory?")) {
      deleteEntry.mutate(entryId, {
        onSuccess: () => {
          toast({
            title: "Deleted",
            description: "Memory has been removed.",
          });
        },
        onError: (error) => {
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive",
          });
        },
      });
    }
  };

  const getBabyName = (babyId: string) => {
    return babies?.find(b => b.id === babyId)?.name || "Unknown";
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Memories
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Memories
          {entries && entries.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {entries.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search memories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Entry List */}
        {!filteredEntries || filteredEntries.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>{search ? "No memories match your search" : "No memories yet"}</p>
            <p className="text-sm mt-1">Add your first memory above!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredEntries.map((entry) => (
              <EntryCard 
                key={entry.id} 
                entry={entry} 
                babyName={getBabyName(entry.baby_id)}
                onDelete={handleDelete}
                showBaby={!babyId}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface EntryCardProps {
  entry: EntryWithTags;
  babyName: string;
  onDelete: (id: string) => void;
  showBaby: boolean;
}

function EntryCard({ entry, babyName, onDelete, showBaby }: EntryCardProps) {
  const TypeIcon = typeIcons[entry.type as keyof typeof typeIcons] || FileText;
  const typeClass = typeColors[entry.type as keyof typeof typeColors] || typeColors.text;

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${typeClass}`}>
            <TypeIcon className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {format(new Date(entry.date), "MMM d, yyyy")}
              </span>
              {showBaby && (
                <Badge variant="outline" className="text-xs">
                  <Baby className="h-3 w-3 mr-1" />
                  {babyName}
                </Badge>
              )}
            </div>
            {entry.file_name && (
              <p className="text-xs text-muted-foreground">{entry.file_name}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {entry.drive_file_id && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => window.open(`https://drive.google.com/file/d/${entry.drive_file_id}/view`, "_blank")}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => onDelete(entry.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {entry.description && (
        <p className="text-sm text-muted-foreground">{entry.description}</p>
      )}

      {entry.entry_tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {entry.entry_tags.map((et) => (
            <Badge 
              key={et.tag_id} 
              variant="secondary" 
              className="text-xs"
              style={{ backgroundColor: `${et.tags.color}20`, color: et.tags.color || undefined }}
            >
              {et.tags.name}
            </Badge>
          ))}
        </div>
      )}

      {entry.thumbnail_url && (
        <img 
          src={entry.thumbnail_url} 
          alt={entry.description || "Memory thumbnail"} 
          className="w-full h-48 object-cover rounded-lg"
        />
      )}
    </div>
  );
}
