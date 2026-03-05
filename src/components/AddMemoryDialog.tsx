import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBabies } from "@/hooks/useBabies";
import { useCreateEntry, useUpdateEntry, type EntryWithTags, type EntryInsert } from "@/hooks/useEntries";
import { useGoogleConnection, useUploadToDrive, useDeleteFromDrive } from "@/hooks/useGoogleDrive";
import { TagCombobox } from "@/components/TagCombobox";
import { toast } from "@/hooks/use-toast";
import { useAuthContext } from "@/contexts/AuthContext";
import { Upload, Loader2, X, Image, Video, Mic, FileText, Save } from "lucide-react";
import { generateAndUploadThumbnail, deleteThumbnail } from "@/lib/thumbnails";
import { uploadAudio, deleteAudio } from "@/lib/audioUpload";

const typeIcons = {
  photo: Image,
  video: Video,
  audio: Mic,
  text: FileText,
};

interface AddMemoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preSelectedBabyId?: string;
  editEntry?: EntryWithTags | null;
}

export function AddMemoryDialog({
  open,
  onOpenChange,
  preSelectedBabyId,
  editEntry,
}: AddMemoryDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [selectedBabyId, setSelectedBabyId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [removeExistingAudio, setRemoveExistingAudio] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const { data: babies } = useBabies();
  const { data: googleConnection } = useGoogleConnection();
  const createEntry = useCreateEntry();
  const updateEntry = useUpdateEntry();
  const uploadToDrive = useUploadToDrive();
  const { user } = useAuthContext();

  const deleteFromDrive = useDeleteFromDrive();
  const isEditing = !!editEntry;
  const isConnected = !!googleConnection?.refresh_token;
  const selectedBaby = babies?.find((b) => b.id === selectedBabyId);
  const [removeExistingFile, setRemoveExistingFile] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (editEntry) {
      setSelectedBabyId(editEntry.baby_id);
      setDescription(editEntry.description || "");
      setDate(editEntry.date);
      setSelectedTags(editEntry.entry_tags.map((et) => et.tag_id));
      setFile(null);
      setAudioFile(null);
      setRemoveExistingFile(false);
      setRemoveExistingAudio(false);
    } else {
      resetForm();
      if (preSelectedBabyId) {
        setSelectedBabyId(preSelectedBabyId);
      } else if (babies?.length === 1) {
        setSelectedBabyId(babies[0].id);
      } else {
        setSelectedBabyId("");
      }
    }
  }, [open, editEntry, preSelectedBabyId, babies]);

  const getFileType = (
    mimeType: string
  ): "photo" | "video" | "audio" | "text" => {
    if (mimeType.startsWith("image/")) return "photo";
    if (mimeType.startsWith("video/")) return "video";
    if (mimeType.startsWith("audio/")) return "audio";
    return "text";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) setFile(selectedFile);
  };

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) setAudioFile(selectedFile);
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const resetForm = () => {
    setDescription("");
    setFile(null);
    setAudioFile(null);
    setSelectedTags([]);
    setRemoveExistingFile(false);
    setRemoveExistingAudio(false);
    setDate(new Date().toISOString().split("T")[0]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (audioInputRef.current) audioInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedBabyId) {
      toast({ title: "Select a child", description: "Please choose which child this memory is for.", variant: "destructive" });
      return;
    }

    if (!isEditing && !file && !audioFile && !description.trim()) {
      toast({ title: "Add content", description: "Please add a file, audio, or description for this memory.", variant: "destructive" });
      return;
    }

    setIsUploading(true);

    try {
      if (isEditing) {
        const entryUpdate: Partial<EntryInsert> = {
          baby_id: selectedBabyId,
          description: description.trim() || null,
          date,
        };

        // Handle file replacement or removal
        const hadFile = !!editEntry.drive_file_id || !!editEntry.file_name;
        const wantsNewFile = !!file;
        const wantsRemoveFile = removeExistingFile;

        if (hadFile && (wantsNewFile || wantsRemoveFile)) {
          if (editEntry.drive_file_id) {
            try {
              await deleteFromDrive.mutateAsync(editEntry.drive_file_id);
            } catch (e) {
              console.warn("Failed to delete old Drive file:", e);
            }
          }
          try {
            await deleteThumbnail(editEntry.id);
          } catch (e) {
            console.warn("Failed to delete old thumbnail:", e);
          }
        }

        if (wantsNewFile) {
          let driveFileId: string | undefined;
          if (isConnected && selectedBaby?.drive_folder_id) {
            const result = await uploadToDrive.mutateAsync({
              file,
              folderId: selectedBaby.drive_folder_id,
            });
            driveFileId = result.fileId;
          }

          entryUpdate.type = getFileType(file.type);
          entryUpdate.drive_file_id = driveFileId || null;
          entryUpdate.file_name = file.name;
          entryUpdate.file_size = file.size;
          entryUpdate.mime_type = file.type;

          await updateEntry.mutateAsync({ entryId: editEntry.id, entry: entryUpdate, tagIds: selectedTags });

          if (file.type.startsWith("image/")) {
            const thumbUrl = await generateAndUploadThumbnail(file, editEntry.id);
            if (thumbUrl) {
              await updateEntry.mutateAsync({ entryId: editEntry.id, entry: { thumbnail_url: thumbUrl } });
            }
          }
        } else if (wantsRemoveFile) {
          entryUpdate.type = "text";
          entryUpdate.drive_file_id = null;
          entryUpdate.file_name = null;
          entryUpdate.file_size = null;
          entryUpdate.mime_type = null;
          entryUpdate.thumbnail_url = null;
          await updateEntry.mutateAsync({ entryId: editEntry.id, entry: entryUpdate, tagIds: selectedTags });
        } else {
          await updateEntry.mutateAsync({ entryId: editEntry.id, entry: entryUpdate, tagIds: selectedTags });
        }

        // Handle audio changes in edit mode
        await handleAudioUpdate(editEntry.id, editEntry);

        toast({ title: "Memory updated!", description: "Your changes have been saved." });
      } else {
        // Create new entry
        let driveFileId: string | undefined;
        let entryType: "photo" | "video" | "audio" | "text" = "text";

        if (file && isConnected && selectedBaby?.drive_folder_id) {
          const result = await uploadToDrive.mutateAsync({
            file,
            folderId: selectedBaby.drive_folder_id,
          });
          driveFileId = result.fileId;
          entryType = getFileType(file.type);
        } else if (file) {
          entryType = getFileType(file.type);
        }

        const newEntry = await createEntry.mutateAsync({
          entry: {
            baby_id: selectedBabyId,
            type: entryType,
            description: description.trim() || null,
            date,
            drive_file_id: driveFileId,
            file_name: file?.name,
            file_size: file?.size,
            mime_type: file?.type,
            created_by: user?.id,
          } as any,
          tagIds: selectedTags,
        });

        // Generate and upload thumbnail for images
        if (file && file.type.startsWith("image/") && newEntry?.id) {
          const thumbUrl = await generateAndUploadThumbnail(file, newEntry.id);
          if (thumbUrl) {
            await updateEntry.mutateAsync({
              entryId: newEntry.id,
              entry: { thumbnail_url: thumbUrl },
            });
          }
        }

        // Upload audio if selected
        if (audioFile && newEntry?.id) {
          const { storagePath, publicUrl } = await uploadAudio(audioFile, newEntry.id);
          await updateEntry.mutateAsync({
            entryId: newEntry.id,
            entry: {
              audio_storage_path: storagePath,
              audio_url: publicUrl,
              audio_file_name: audioFile.name,
              audio_file_size: audioFile.size,
            } as any,
          });
        }

        toast({
          title: "Memory saved!",
          description: driveFileId
            ? "Your memory has been saved and uploaded to Google Drive."
            : "Your memory has been saved.",
        });
      }

      resetForm();
      onOpenChange(false);
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save memory",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleAudioUpdate = async (entryId: string, entry: EntryWithTags) => {
    const hadAudio = !!(entry as any).audio_storage_path;
    const wantsNewAudio = !!audioFile;
    const wantsRemoveAudio = removeExistingAudio;

    if (hadAudio && (wantsNewAudio || wantsRemoveAudio)) {
      try {
        await deleteAudio((entry as any).audio_storage_path);
      } catch (e) {
        console.warn("Failed to delete old audio:", e);
      }
    }

    if (wantsNewAudio) {
      const { storagePath, publicUrl } = await uploadAudio(audioFile, entryId);
      await updateEntry.mutateAsync({
        entryId,
        entry: {
          audio_storage_path: storagePath,
          audio_url: publicUrl,
          audio_file_name: audioFile.name,
          audio_file_size: audioFile.size,
        } as any,
      });
    } else if (wantsRemoveAudio && hadAudio) {
      await updateEntry.mutateAsync({
        entryId,
        entry: {
          audio_storage_path: null,
          audio_url: null,
          audio_file_name: null,
          audio_file_size: null,
        } as any,
      });
    }
  };

  const TypeIcon = file ? typeIcons[getFileType(file.type)] : Upload;
  const existingAudioName = isEditing ? (editEntry as any)?.audio_file_name : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Memory" : "Add Memory"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update this memory" : "Capture a precious moment"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 min-w-0">
          {/* Child selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">Child</label>
            <Select value={selectedBabyId} onValueChange={setSelectedBabyId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a child" />
              </SelectTrigger>
              <SelectContent>
                {babies?.map((baby) => (
                  <SelectItem key={baby.id} value={baby.id}>
                    {baby.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date */}
          <div>
            <label className="text-sm font-medium mb-2 block">Date</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          {/* Hidden file inputs */}
          <Input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleFileChange}
            className="hidden"
            id="dialog-file-upload"
          />
          <Input
            ref={audioInputRef}
            type="file"
            accept="audio/*"
            onChange={handleAudioChange}
            className="hidden"
            id="dialog-audio-upload"
          />

          {/* ===== Photo/Video file section ===== */}
          {!isEditing && (
            <div>
              <label className="text-sm font-medium mb-2 block">Photo/Video (optional)</label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full"
                >
                  <TypeIcon className="h-4 w-4 mr-2" />
                  {file ? file.name : "Choose photo or video"}
                </Button>
                {file && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {!isConnected && file && (
                <p className="text-xs text-muted-foreground mt-1">
                  Connect Google Drive to upload files
                </p>
              )}
            </div>
          )}

          {/* Edit mode: no existing file — allow adding one */}
          {isEditing && !editEntry.file_name && !file && (
            <div>
              <label className="text-sm font-medium mb-2 block">Photo/Video (optional)</label>
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                Add photo or video
              </Button>
            </div>
          )}

          {/* Edit mode: no existing file but new file chosen */}
          {isEditing && !editEntry.file_name && file && (
            <div>
              <label className="text-sm font-medium mb-2 block">New file</label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full"
                >
                  <TypeIcon className="h-4 w-4 mr-2" />
                  {file.name}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => {
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Edit mode: has existing file — replace or delete */}
          {isEditing && editEntry.file_name && !removeExistingFile && !file && (
            <div>
              <label className="text-sm font-medium mb-2 block">Attached file</label>
              <div className="flex w-full min-w-0 items-center gap-2">
                <p className="text-sm text-muted-foreground flex-1 min-w-0 truncate">{editEntry.file_name}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Replace
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setRemoveExistingFile(true)}
                >
                  Delete
                </Button>
              </div>
            </div>
          )}

          {/* Show replacement file or "file removed" state in edit mode */}
          {isEditing && (removeExistingFile || file) && editEntry.file_name && (
            <div>
              <label className="text-sm font-medium mb-2 block">
                {file ? "Replacement file" : "File will be deleted"}
              </label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full"
                >
                  <TypeIcon className="h-4 w-4 mr-2" />
                  {file ? file.name : "Choose replacement file (optional)"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => {
                    setFile(null);
                    setRemoveExistingFile(false);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {!file && removeExistingFile && (
                <p className="text-xs text-destructive mt-1">
                  The existing file will be deleted on save. Click ✕ to undo.
                </p>
              )}
            </div>
          )}

          {/* ===== Audio section ===== */}
          {!isEditing && (
            <div>
              <label className="text-sm font-medium mb-2 block">Audio (optional)</label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => audioInputRef.current?.click()}
                  className="w-full"
                >
                  <Mic className="h-4 w-4 mr-2" />
                  {audioFile ? audioFile.name : "Choose audio file"}
                </Button>
                {audioFile && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setAudioFile(null);
                      if (audioInputRef.current) audioInputRef.current.value = "";
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Edit mode: existing audio — replace or delete */}
          {isEditing && existingAudioName && !removeExistingAudio && !audioFile && (
            <div>
              <label className="text-sm font-medium mb-2 block">Attached audio</label>
              <div className="flex w-full min-w-0 items-center gap-2">
                <Mic className="h-4 w-4 text-muted-foreground shrink-0" />
                <p className="text-sm text-muted-foreground flex-1 min-w-0 truncate">{existingAudioName}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => audioInputRef.current?.click()}
                >
                  Replace
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setRemoveExistingAudio(true)}
                >
                  Delete
                </Button>
              </div>
            </div>
          )}

          {/* Edit mode: no existing audio — allow adding */}
          {isEditing && !existingAudioName && !audioFile && (
            <div>
              <label className="text-sm font-medium mb-2 block">Audio (optional)</label>
              <Button
                type="button"
                variant="outline"
                onClick={() => audioInputRef.current?.click()}
                className="w-full"
              >
                <Mic className="h-4 w-4 mr-2" />
                Add audio
              </Button>
            </div>
          )}

          {/* Edit mode: new audio chosen (no existing or replacing) */}
          {isEditing && audioFile && (
            <div>
              <label className="text-sm font-medium mb-2 block">
                {existingAudioName ? "Replacement audio" : "New audio"}
              </label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => audioInputRef.current?.click()}
                  className="w-full"
                >
                  <Mic className="h-4 w-4 mr-2" />
                  {audioFile.name}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => {
                    setAudioFile(null);
                    setRemoveExistingAudio(false);
                    if (audioInputRef.current) audioInputRef.current.value = "";
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Edit mode: audio will be deleted */}
          {isEditing && removeExistingAudio && !audioFile && (
            <div>
              <label className="text-sm font-medium mb-2 block">Audio will be deleted</label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => audioInputRef.current?.click()}
                  className="w-full"
                >
                  <Mic className="h-4 w-4 mr-2" />
                  Choose replacement audio (optional)
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => {
                    setRemoveExistingAudio(false);
                    if (audioInputRef.current) audioInputRef.current.value = "";
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-destructive mt-1">
                The existing audio will be deleted on save. Click ✕ to undo.
              </p>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="text-sm font-medium mb-2 block">Description</label>
            <Textarea
              placeholder="What's happening in this memory?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Tags */}
          <div>
            <label className="text-sm font-medium mb-2 block">Tags</label>
            <TagCombobox selectedTagIds={selectedTags} onToggleTag={toggleTag} />
          </div>

          {/* Submit */}
          <Button type="submit" className="w-full" disabled={isUploading || !babies?.length}>
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {isEditing ? "Updating..." : "Saving..."}
              </>
            ) : (
              <>
                {isEditing ? <Save className="h-4 w-4 mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                {isEditing ? "Update Memory" : "Save Memory"}
              </>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
