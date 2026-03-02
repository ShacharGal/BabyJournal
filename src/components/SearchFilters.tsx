import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTags } from "@/hooks/useTags";
import { Search, X } from "lucide-react";

export interface Filters {
  text: string;
  tagIds: string[];
  dateFrom: string;
  dateTo: string;
}

interface SearchFiltersProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

export function SearchFilters({ filters, onChange }: SearchFiltersProps) {
  const { data: tags } = useTags();

  const update = (partial: Partial<Filters>) =>
    onChange({ ...filters, ...partial });

  const toggleTag = (tagId: string) => {
    const ids = filters.tagIds.includes(tagId)
      ? filters.tagIds.filter((id) => id !== tagId)
      : [...filters.tagIds, tagId];
    update({ tagIds: ids });
  };

  const hasActiveFilters =
    filters.tagIds.length > 0 || filters.dateFrom || filters.dateTo;

  const clearAll = () =>
    onChange({ text: "", tagIds: [], dateFrom: "", dateTo: "" });

  return (
    <div className="space-y-3">
      {/* Text search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="חיפוש זיכרונות..."
          value={filters.text}
          onChange={(e) => update({ text: e.target.value })}
          className="pl-9"
          autoFocus
        />
      </div>

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
        <span className="text-xs text-muted-foreground shrink-0">→</span>
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
