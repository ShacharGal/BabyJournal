import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Send, Camera, Tags, X } from "lucide-react";
import { VoiceMenu } from "./VoiceMenu";
import { TagCombobox, InlineTagPanel } from "@/components/TagCombobox";
import { useIsMobile } from "@/hooks/use-mobile";
import type { AddMemoryFormReturn } from "./useAddMemoryForm";

interface BottomToolbarProps {
  form: AddMemoryFormReturn;
}

export function BottomToolbar({ form }: BottomToolbarProps) {
  const {
    isEditing, isUploading, babies, recorder,
    selectedTags, toggleTag,
    cameraInputRef, audioInputRef,
    handleCameraFilesChange, handleAudioChange,
    hasAnyAudio,
  } = form;

  const isMobile = useIsMobile();
  const [tagsExpanded, setTagsExpanded] = useState(false);

  return (
    <>
      {/* Inline tag panel for mobile */}
      {isMobile && tagsExpanded && (
        <InlineTagPanel selectedTagIds={selectedTags} onToggleTag={toggleTag} />
      )}

      <div className="border-t px-3 py-2 flex items-center gap-2">
        {/* Voice menu */}
        <VoiceMenu
          onRecord={() => recorder.start()}
          onAttachFile={() => audioInputRef.current?.click()}
          disabled={isUploading || hasAnyAudio || recorder.isRecording}
        />

        {/* Camera button */}
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-11 w-11 rounded-full"
          onClick={() => cameraInputRef.current?.click()}
          disabled={isUploading}
        >
          <Camera className="h-6 w-6" />
        </Button>

        {/* Tags */}
        {isMobile ? (
          <Button
            variant="outline"
            size="icon"
            type="button"
            className="h-11 w-11 rounded-full relative"
            onClick={() => {
              // Dismiss keyboard before expanding so viewport is at full height
              if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur();
              }
              setTagsExpanded((prev) => !prev);
            }}
          >
            {tagsExpanded ? <X className="h-6 w-6" /> : <Tags className="h-6 w-6" />}
            {!tagsExpanded && selectedTags.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">
                {selectedTags.length}
              </span>
            )}
          </Button>
        ) : (
          <TagCombobox selectedTagIds={selectedTags} onToggleTag={toggleTag} iconOnly />
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Publish / Update button */}
        <Button
          type="submit"
          size="sm"
          disabled={isUploading || !babies?.length || recorder.isRecording}
          className="gap-1.5 bg-primary text-primary-foreground"
        >
          <Send className="h-4 w-4" />
          {isEditing ? "Update" : "Publish"}
        </Button>

        {/* Hidden file inputs */}
        <input
          ref={cameraInputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          className="hidden"
          onChange={handleCameraFilesChange}
        />
        <input
          ref={audioInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleAudioChange}
        />
      </div>
    </>
  );
}
