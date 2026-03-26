import { useState, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import { useVisualViewport } from "@/hooks/useVisualViewport";
import { useAllNicknames, type EntryWithTags } from "@/hooks/useEntries";
import { useAddMemoryForm } from "./useAddMemoryForm";
import { UploadOverlay } from "./UploadOverlay";
import { AddMemoryHeader } from "./AddMemoryHeader";
import { InlineRecorder } from "./InlineRecorder";
import { MediaPreviewBar } from "./MediaPreviewBar";
import { BottomToolbar } from "./BottomToolbar";

interface AddMemoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preSelectedBabyId?: string;
  editEntry?: EntryWithTags | null;
  initialFiles?: File[];
}

function AddMemoryContent({ form }: { form: ReturnType<typeof useAddMemoryForm> }) {
  const {
    babies, selectedBabyId, setSelectedBabyId,
    title, setTitle,
    date, setDate,
    postType, setPostType,
    description, setDescription,
    isUploading, uploadStatus,
    isEditing, recorder,
    file, secondaryFiles,
  } = form;

  const { data: allNicknames = [] } = useAllNicknames();
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);

  const filteredMentions = mentionQuery !== null
    ? allNicknames.filter((n) => n.toLowerCase().startsWith(mentionQuery.toLowerCase())).slice(0, 5)
    : [];

  const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setDescription(val);

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    // Find the last @ that's either at start of text or preceded by whitespace/newline
    const atMatch = textBeforeCursor.match(/(?:^|[\s\n])@([^\s\n]*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1]);
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
  }, [setDescription]);

  const insertMention = useCallback((nickname: string) => {
    const textarea = descriptionRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = description.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/(?:^|[\s\n])@([^\s\n]*)$/);
    if (!atMatch) return;

    // Find the position of @ in the match
    const matchStart = cursorPos - atMatch[0].length;
    const atPos = matchStart + (atMatch[0].length - atMatch[1].length - 1); // position of @
    const newText = description.slice(0, atPos) + "@" + nickname + " " + description.slice(cursorPos);
    setDescription(newText);
    setMentionQuery(null);

    const newCursorPos = atPos + nickname.length + 2;
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    });
  }, [description, setDescription]);

  const handleDescriptionKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery === null || filteredMentions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMentionIndex((i) => (i + 1) % filteredMentions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMentionIndex((i) => (i - 1 + filteredMentions.length) % filteredMentions.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      insertMention(filteredMentions[mentionIndex]);
    } else if (e.key === "Escape") {
      setMentionQuery(null);
    }
  }, [mentionQuery, filteredMentions, mentionIndex, insertMention]);

  return (
    <form onSubmit={form.handleSubmit} className="flex flex-col relative">
      {/* Upload overlay */}
      {isUploading && (
        <UploadOverlay
          uploadStatus={uploadStatus}
          hasVideoOrMultiple={!!file?.type.startsWith("video/") || (Array.isArray(secondaryFiles) && secondaryFiles.length > 0)}
        />
      )}

      {/* Title */}
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-lg font-semibold text-center">
          {isEditing ? "Edit memory" : "Add a memory"}
        </h2>
        <Separator className="mt-3" />
      </div>

      {/* Header: baby + date */}
      <AddMemoryHeader
        babies={babies}
        selectedBabyId={selectedBabyId}
        onSelectBaby={setSelectedBabyId}
        date={date}
        onDateChange={setDate}
      />

      {/* Entry type */}
      <div className="px-4 pb-3 flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Entry type</span>
        <Select value={postType} onValueChange={(v: "standard" | "dialogue" | "milestone") => setPostType(v)}>
          <SelectTrigger className="w-auto h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="standard">Standard</SelectItem>
            <SelectItem value="dialogue">Dialogue / Quote</SelectItem>
            <SelectItem value="milestone">Milestone</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Optional title */}
      <div className="px-4 pb-1">
        <Input
          dir="auto"
          placeholder="Title (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-9 text-sm font-semibold border bg-accent/30 rounded-lg focus-visible:ring-1"
        />
      </div>

      {/* Hero textarea with @mention autocomplete */}
      <div className="px-4 pb-2 h-[160px] relative">
        <Textarea
          ref={descriptionRef}
          dir="auto"
          placeholder="Add your text... Use @ to mention someone"
          value={description}
          onChange={handleDescriptionChange}
          onKeyDown={handleDescriptionKeyDown}
          className="h-full resize-none overflow-y-auto border bg-accent/30 rounded-lg focus-visible:ring-1"
        />
        {mentionQuery !== null && filteredMentions.length > 0 && (
          <div className="absolute z-50 left-4 right-4 bg-white border border-stone-200 rounded-lg shadow-lg overflow-hidden"
            style={{ bottom: "calc(100% - 8px)" }}
          >
            {filteredMentions.map((nickname, i) => (
              <button
                key={nickname}
                type="button"
                className={`w-full text-left px-3 py-2.5 text-sm ${
                  i === mentionIndex ? "bg-blue-50 text-blue-700" : "hover:bg-stone-50"
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(nickname);
                }}
              >
                @{nickname}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Inline recorder */}
      {recorder.isRecording && (
        <InlineRecorder
          duration={recorder.duration}
          isPaused={recorder.isPaused}
          onPause={recorder.pause}
          onResume={recorder.resume}
          onStop={recorder.stop}
        />
      )}

      {/* Media preview bar */}
      <MediaPreviewBar form={form} />

      {/* Bottom toolbar */}
      <BottomToolbar form={form} />
    </form>
  );
}

export function AddMemoryDialog({ open, onOpenChange, preSelectedBabyId, editEntry, initialFiles }: AddMemoryDialogProps) {
  const isMobile = useIsMobile();
  const form = useAddMemoryForm({ open, onOpenChange, preSelectedBabyId, editEntry, initialFiles });

  const viewportHeight = useVisualViewport();

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="p-0 flex flex-col rounded-t-xl"
          style={{ maxHeight: viewportHeight }}
          onInteractOutside={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onFocusOutside={(e) => e.preventDefault()}
        >
          <SheetTitle className="sr-only">{form.isEditing ? "Edit memory" : "Add a memory"}</SheetTitle>
          <SheetDescription className="sr-only">
            {form.isEditing ? "Update this memory" : "Capture a precious moment"}
          </SheetDescription>
          <AddMemoryContent form={form} />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg max-h-[90vh] p-0 flex flex-col overflow-hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onFocusOutside={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">{form.isEditing ? "Edit memory" : "Add a memory"}</DialogTitle>
        <DialogDescription className="sr-only">
          {form.isEditing ? "Update this memory" : "Capture a precious moment"}
        </DialogDescription>
        <AddMemoryContent form={form} />
      </DialogContent>
    </Dialog>
  );
}
