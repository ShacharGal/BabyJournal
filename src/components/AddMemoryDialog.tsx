import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  const [selectedBabyId, setSelectedBabyId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { data: babies } = useBabies();
  // tags are handled by TagCombobox
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

  // Pre-fill form when dialog opens
  useEffect(() => {
    if (!open) return;

    if (editEntry) {
      setSelectedBabyId(editEntry.baby_id);
      setDescription(editEntry.description || "");
      setDate(editEntry.date);
      setSelectedTags(editEntry.entry_tags.map((et) => et.tag_id));
      setFile(null);
      setRemoveExistingFile(false);
    } else {
      // Reset everything for create mode
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

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const resetForm = () => {
    setDescription("");
    setFile(null);
    setSelectedTags([]);
    setRemoveExistingFile(false);
    setDate(new Date().toISOString().split("T")[0]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedBabyId) {
      toast({ title: "Select a child", description: "Please choose which child this memory is for.", variant: "destructive" });
      return;
    }

    if (!isEditing && !file && !description.trim()) {
      toast({ title: "Add content", description: "Please add a file or description for this memory.", variant: "destructive" });
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
          // Delete old Drive file
          if (editEntry.drive_file_id) {
            try {
              await deleteFromDrive.mutateAsync(editEntry.drive_file_id);
            } catch (e) {
              console.warn("Failed to delete old Drive file:", e);
            }
          }
          // Delete old thumbnail
          try {
            await deleteThumbnail(editEntry.id);
          } catch (e) {
            console.warn("Failed to delete old thumbnail:", e);
          }
        }

        if (wantsNewFile) {
          // Upload replacement file
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

          // Generate thumbnail for new image
          if (file.type.startsWith("image/")) {
            const thumbUrl = await generateAndUploadThumbnail(file, editEntry.id);
            if (thumbUrl) {
              await updateEntry.mutateAsync({ entryId: editEntry.id, entry: { thumbnail_url: thumbUrl } });
            }
          }
        } else if (wantsRemoveFile) {
          // Clear file fields
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
          },
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

  const TypeIcon = file ? typeIcons[getFileType(file.type)] : Upload;

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

          {/* Hidden file input — always rendered */}
          <Input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,audio/*"
            onChange={handleFileChange}
            className="hidden"
            id="dialog-file-upload"
          />

          {/* File - new entry mode */}
          {!isEditing && (
            <div>
              <label className="text-sm font-medium mb-2 block">File (optional)</label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full"
                >
                  <TypeIcon className="h-4 w-4 mr-2" />
                  {file ? file.name : "Choose file"}
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
              <label className="text-sm font-medium mb-2 block">File (optional)</label>
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                Add file
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
          {isEditing && (removeExistingFile || file) && (
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
