import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useTags, useCreateTag, useDeleteTag } from "@/hooks/useTags";
import { Check, Plus, Tags, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TagComboboxProps {
  selectedTagIds: string[];
  onToggleTag: (tagId: string) => void;
  iconOnly?: boolean;
  canDelete?: boolean;
}

export function TagCombobox({ selectedTagIds, onToggleTag, iconOnly, canDelete }: TagComboboxProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const { data: tags } = useTags();
  const createTag = useCreateTag();
  const deleteTag = useDeleteTag();

  const handleCreateTag = async () => {
    if (!inputValue.trim()) return;
    try {
      const newTag = await createTag.mutateAsync({ name: inputValue.trim() });
      onToggleTag(newTag.id);
      setInputValue("");
    } catch {
      // tag might already exist
    }
  };

  const handleDeleteTag = async (tagId: string, tagName: string) => {
    if (!confirm(`Delete tag "${tagName}"? It will be removed from all entries.`)) return;
    try {
      await deleteTag.mutateAsync(tagId);
    } catch {
      // ignore
    }
  };

  const exactMatch = tags?.some(
    (t) => t.name.toLowerCase() === inputValue.trim().toLowerCase()
  );

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {iconOnly ? (
            <Button variant="outline" size="icon" type="button" className="h-11 w-11 rounded-full relative">
              <Tags className="h-6 w-6" />
              {selectedTagIds.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">
                  {selectedTagIds.length}
                </span>
              )}
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="gap-1.5 h-8">
              <Tags className="h-3.5 w-3.5" />
              {selectedTagIds.length > 0
                ? `${selectedTagIds.length} tag${selectedTagIds.length > 1 ? "s" : ""}`
                : "Add tags"}
            </Button>
          )}
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0" align="start" side="top">
          <Command>
            <CommandInput
              placeholder="Search or create tag..."
              value={inputValue}
              onValueChange={setInputValue}
            />
            <CommandList className="max-h-[200px]">
              <CommandEmpty className="py-2 px-3 text-sm text-muted-foreground">
                No tags found
              </CommandEmpty>
              <CommandGroup>
                {tags?.map((tag) => (
                  <CommandItem
                    key={tag.id}
                    value={tag.name}
                    onSelect={() => onToggleTag(tag.id)}
                  >
                    <div
                      className="h-3 w-3 rounded-full mr-2 shrink-0"
                      style={{ backgroundColor: tag.color || "#6366f1" }}
                    />
                    <span className="flex-1">{tag.name}</span>
                    <Check
                      className={cn(
                        "h-4 w-4 shrink-0",
                        selectedTagIds.includes(tag.id) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {canDelete && (
                      <button
                        type="button"
                        className="ml-1 p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTag(tag.id, tag.name);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
              {inputValue.trim() && !exactMatch && (
                <CommandGroup>
                  <CommandItem onSelect={handleCreateTag}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create "{inputValue.trim()}"
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected tags display */}
      {!iconOnly && selectedTagIds.length > 0 && tags && (
        <div className="flex flex-wrap gap-1">
          {selectedTagIds.map((id) => {
            const tag = tags.find((t) => t.id === id);
            if (!tag) return null;
            return (
              <Badge
                key={id}
                variant="secondary"
                className="cursor-pointer text-xs gap-1"
                style={{
                  backgroundColor: `${tag.color}20`,
                  color: tag.color || undefined,
                }}
                onClick={() => onToggleTag(id)}
              >
                {tag.name} ×
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Inline tag panel for mobile — renders within the form flow, no popover/keyboard */
export function InlineTagPanel({
  selectedTagIds,
  onToggleTag,
  canDelete,
}: {
  selectedTagIds: string[];
  onToggleTag: (tagId: string) => void;
  canDelete?: boolean;
}) {
  const { data: tags } = useTags();
  const createTag = useCreateTag();
  const deleteTag = useDeleteTag();
  const [newTagName, setNewTagName] = useState("");

  const handleCreate = async () => {
    const name = newTagName.trim();
    if (!name) return;
    const exists = tags?.some((t) => t.name.toLowerCase() === name.toLowerCase());
    if (exists) return;
    try {
      const newTag = await createTag.mutateAsync({ name });
      onToggleTag(newTag.id);
      setNewTagName("");
    } catch {
      // tag might already exist
    }
  };

  const handleDelete = async (tagId: string, tagName: string) => {
    if (!confirm(`Delete tag "${tagName}"? It will be removed from all entries.`)) return;
    try {
      await deleteTag.mutateAsync(tagId);
    } catch {
      // ignore
    }
  };

  return (
    <div className="border-t px-3 py-2 max-h-[180px] overflow-y-auto">
      {/* Existing tags */}
      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map((tag) => {
            const selected = selectedTagIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => onToggleTag(tag.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm border transition-colors",
                  selected
                    ? "border-transparent font-medium"
                    : "border-border bg-background text-muted-foreground"
                )}
                style={
                  selected
                    ? { backgroundColor: `${tag.color || "#6366f1"}25`, color: tag.color || "#6366f1" }
                    : undefined
                }
              >
                <div
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: tag.color || "#6366f1" }}
                />
                {tag.name}
                {selected && <Check className="h-3.5 w-3.5" />}
                {canDelete && (
                  <span
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(tag.id, tag.name);
                    }}
                    className="ml-0.5 p-0.5 rounded-full hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Create new tag */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="New tag name..."
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCreate(); } }}
          className="flex-1 h-8 px-2 text-sm border rounded-md bg-background"
        />
        <button
          type="button"
          onClick={handleCreate}
          disabled={!newTagName.trim() || createTag.isPending}
          className="inline-flex items-center gap-1 h-8 px-3 text-sm rounded-md bg-primary text-primary-foreground disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </div>
    </div>
  );
}
