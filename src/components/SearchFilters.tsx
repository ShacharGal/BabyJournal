import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUsedTags } from "@/hooks/useTags";
import { Search, X } from "lucide-react";
import { useEntryContributors, useAllNicknames } from "@/hooks/useEntries";

export interface Filters {
  text: string;
  tagIds: string[];
  dateFrom: string;
  dateTo: string;
  entryType: string;
  postType: string;
  contributorId: string;
  mentionedNickname: string;
}

interface SearchFiltersProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

export function SearchFilters({ filters, onChange }: SearchFiltersProps) {
  const { data: tags } = useUsedTags();
  const { data: contributors } = useEntryContributors();
  const { data: allNicknames = [] } = useAllNicknames();

  const update = (partial: Partial<Filters>) =>
    onChange({ ...filters, ...partial });

  const toggleTag = (tagId: string) => {
    const ids = filters.tagIds.includes(tagId)
      ? filters.tagIds.filter((id) => id !== tagId)
      : [...filters.tagIds, tagId];
    update({ tagIds: ids });
  };

  const hasActiveFilters =
    filters.tagIds.length > 0 ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.entryType ||
    filters.postType ||
    filters.contributorId ||
    filters.mentionedNickname;

  const clearAll = () =>
    onChange({
      text: "",
      tagIds: [],
      dateFrom: "",
      dateTo: "",
      entryType: "",
      postType: "",
      contributorId: "",
      mentionedNickname: "",
    });

  return (
    <div className="space-y-3">
      {/* Text search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search memories..."
          value={filters.text}
          onChange={(e) => update({ text: e.target.value })}
          className="pl-9"
          autoFocus
        />
      </div>

      {/* Type filters row */}
      <div className="flex gap-2">
        <Select
          value={filters.entryType || "_all"}
          onValueChange={(v) => update({ entryType: v === "_all" ? "" : v })}
        >
          <SelectTrigger className="h-8 text-xs flex-1">
            <SelectValue placeholder="Media type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All types</SelectItem>
            <SelectItem value="photo">Photo</SelectItem>
            <SelectItem value="video">Video</SelectItem>
            <SelectItem value="audio">Audio</SelectItem>
            <SelectItem value="text">Text only</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.postType || "_all"}
          onValueChange={(v) => update({ postType: v === "_all" ? "" : v })}
        >
          <SelectTrigger className="h-8 text-xs flex-1">
            <SelectValue placeholder="Entry style" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All styles</SelectItem>
            <SelectItem value="standard">Standard</SelectItem>
            <SelectItem value="dialogue">Dialogue / Quote</SelectItem>
            <SelectItem value="milestone">Milestone</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Contributor filter */}
      {contributors && contributors.length > 1 && (
        <Select
          value={filters.contributorId || "_all"}
          onValueChange={(v) => update({ contributorId: v === "_all" ? "" : v })}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Added by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All contributors</SelectItem>
            {contributors.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nickname}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Mentioned user filter */}
      {allNicknames.length > 0 && (
        <Select
          value={filters.mentionedNickname || "_all"}
          onValueChange={(v) => update({ mentionedNickname: v === "_all" ? "" : v })}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Mentions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All mentions</SelectItem>
            {allNicknames.map((nick) => (
              <SelectItem key={nick} value={nick}>
                @{nick}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Tag filters */}
      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => {
            const active = filters.tagIds.includes(tag.id);
            return (
              <Badge
                key={tag.id}
                variant={active ? "default" : "outline"}
                className="cursor-pointer text-xs transition-colors"
                style={{
                  backgroundColor: active ? tag.color || undefined : undefined,
                  borderColor: tag.color || undefined,
                  color: active ? "white" : tag.color || undefined,
                }}
                onClick={() => toggleTag(tag.id)}
              >
                {tag.name}
              </Badge>
            );
          })}
        </div>
      )}

      {/* Date range */}
      <div className="flex items-center gap-2">
        <Input
          type="date"
          placeholder="From"
          value={filters.dateFrom}
          onChange={(e) => update({ dateFrom: e.target.value })}
          className="text-xs h-8"
        />
        <span className="text-xs text-muted-foreground shrink-0">&rarr;</span>
        <Input
          type="date"
          placeholder="To"
          value={filters.dateTo}
          onChange={(e) => update({ dateTo: e.target.value })}
          className="text-xs h-8"
        />
      </div>

      {/* Clear all */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={clearAll}
        >
          <X className="h-3 w-3" />
          Clear filters
        </Button>
      )}
    </div>
  );
}
