import { Button } from "@/components/ui/button";
import { Send, Camera } from "lucide-react";
import { VoiceMenu } from "./VoiceMenu";
import { TagCombobox } from "@/components/TagCombobox";
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

  return (
    <div className="border-t px-3 py-2 flex items-center gap-1">
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

      {/* Spacer */}
      <div className="flex-1" />

      {/* Voice menu */}
      <VoiceMenu
        onRecord={() => recorder.start()}
        onAttachFile={() => audioInputRef.current?.click()}
        disabled={isUploading || hasAnyAudio || recorder.isRecording}
      />

      {/* Camera button */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-full"
        onClick={() => cameraInputRef.current?.click()}
        disabled={isUploading}
      >
        <Camera className="h-5 w-5" />
      </Button>

      {/* Tags */}
      <TagCombobox selectedTagIds={selectedTags} onToggleTag={toggleTag} iconOnly />

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
  );
}
