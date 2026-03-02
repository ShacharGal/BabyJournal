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
import { useTags, useCreateTag } from "@/hooks/useTags";
import { Check, Plus, Tags } from "lucide-react";
import { cn } from "@/lib/utils";

interface TagComboboxProps {
  selectedTagIds: string[];
  onToggleTag: (tagId: string) => void;
}

export function TagCombobox({ selectedTagIds, onToggleTag }: TagComboboxProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const { data: tags } = useTags();
  const createTag = useCreateTag();

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

  const exactMatch = tags?.some(
    (t) => t.name.toLowerCase() === inputValue.trim().toLowerCase()
  );

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 h-8">
            <Tags className="h-3.5 w-3.5" />
            {selectedTagIds.length > 0
              ? `${selectedTagIds.length} tag${selectedTagIds.length > 1 ? "s" : ""}`
              : "Add tags"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search or create tag..."
              value={inputValue}
              onValueChange={setInputValue}
            />
            <CommandList>
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
      {selectedTagIds.length > 0 && tags && (
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
