import {
  Dialog,
  DialogContent,
  DialogTitle,
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
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import type { EntryWithTags } from "@/hooks/useEntries";
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
}

function AddMemoryContent({ form }: { form: ReturnType<typeof useAddMemoryForm> }) {
  const {
    babies, selectedBabyId, setSelectedBabyId,
    date, setDate,
    postType, setPostType,
    description, setDescription,
    isUploading, uploadStatus,
    isEditing, recorder,
    file, secondaryFiles,
  } = form;

  return (
    <form onSubmit={form.handleSubmit} className="flex flex-col h-full relative">
      {/* Upload overlay */}
      {isUploading && (
        <UploadOverlay
          uploadStatus={uploadStatus}
          hasVideoOrMultiple={!!file?.type.startsWith("video/") || secondaryFiles.length > 0}
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
        <Select value={postType} onValueChange={(v: "standard" | "dialogue") => setPostType(v)}>
          <SelectTrigger className="w-auto h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="standard">Standard</SelectItem>
            <SelectItem value="dialogue">Dialogue / Quote</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Hero textarea */}
      <div className="flex-1 px-4 pb-2 min-h-0">
        <Textarea
          dir="auto"
          placeholder="Add your text..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="h-full min-h-[120px] resize-none border bg-accent/30 rounded-lg focus-visible:ring-1"
        />
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

export function AddMemoryDialog({ open, onOpenChange, preSelectedBabyId, editEntry }: AddMemoryDialogProps) {
  const isMobile = useIsMobile();
  const form = useAddMemoryForm({ open, onOpenChange, preSelectedBabyId, editEntry });

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[100dvh] p-0 flex flex-col">
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
      <DialogContent className="max-w-lg max-h-[90vh] p-0 flex flex-col overflow-hidden">
        <DialogTitle className="sr-only">{form.isEditing ? "Edit memory" : "Add a memory"}</DialogTitle>
        <AddMemoryContent form={form} />
      </DialogContent>
    </Dialog>
  );
}
