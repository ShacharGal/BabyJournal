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
import { useCreateEntry, useUpdateEntry, type EntryWithTags } from "@/hooks/useEntries";
import { useGoogleConnection, useUploadToDrive, useDeleteFromDrive } from "@/hooks/useGoogleDrive";
import { TagCombobox } from "@/components/TagCombobox";
import { toast } from "@/hooks/use-toast";
import { useAuthContext } from "@/contexts/AuthContext";
import { Upload, Loader2, X, Image, Video, Mic, FileText, Save, Square, Circle, Paperclip, Quote, Plus } from "lucide-react";
import { generateAndUploadThumbnail, deleteThumbnail, generateVideoThumbnail } from "@/lib/thumbnails";
import { uploadAudio, deleteAudio } from "@/lib/audioUpload";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { extractDateFromFile } from "@/lib/exifDate";
import { supabase } from "@/integrations/supabase/client";
import { APP_VERSION } from "@/main";

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

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AddMemoryDialog({
  open,
  onOpenChange,
  preSelectedBabyId,
  editEntry,
}: AddMemoryDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const secondaryInputRef = useRef<HTMLInputElement>(null);
  const [selectedBabyId, setSelectedBabyId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [postType, setPostType] = useState<"standard" | "dialogue">("standard");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [secondaryFiles, setSecondaryFiles] = useState<File[]>([]);
  const [removeSecondaryIds, setRemoveSecondaryIds] = useState<string[]>([]);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [removeExistingAudio, setRemoveExistingAudio] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [removeExistingFile, setRemoveExistingFile] = useState(false);

  const recorder = useAudioRecorder();

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

  useEffect(() => {
    if (!open) return;

    if (editEntry) {
      setSelectedBabyId(editEntry.baby_id);
      setDescription(editEntry.description || "");
      setDate(editEntry.date);
      setPostType(((editEntry as any).post_type as "standard" | "dialogue") || "standard");
      setSelectedTags(editEntry.entry_tags.map((et) => et.tag_id));
      setFile(null);
      setSecondaryFiles([]);
      setRemoveSecondaryIds([]);
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      // Try to extract date from EXIF
      const exifDate = await extractDateFromFile(selectedFile);
      if (exifDate) setDate(exifDate);
    }
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
    setSecondaryFiles([]);
    setRemoveSecondaryIds([]);
    setAudioFile(null);
    setSelectedTags([]);
    setPostType("standard");
    setRemoveExistingFile(false);
    setRemoveExistingAudio(false);
    setUploadStatus("");
    setDate(new Date().toISOString().split("T")[0]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (audioInputRef.current) audioInputRef.current.value = "";
    if (secondaryInputRef.current) secondaryInputRef.current.value = "";
    recorder.discard();
  };

  const getEffectiveAudioFile = (): File | null => {
    if (audioFile) return audioFile;
    if (recorder.blob) {
      return new File([recorder.blob], `recording-${Date.now()}.webm`, { type: "audio/webm" });
    }
    return null;
  };

  /** Upload primary file to Drive + generate thumbnail. Returns { driveFileId, thumbUrl } */
  const uploadPrimaryFile = async (f: File, entryId: string, folderId: string | null): Promise<{ driveFileId: string | null; thumbUrl: string | null }> => {
    let driveFileId: string | null = null;
    let thumbUrl: string | null = null;

    // Upload to Drive
    if (folderId) {
      setUploadStatus(f.type.startsWith("video/") ? "Uploading video..." : "Uploading photo...");
      const result = await uploadToDrive.mutateAsync({ file: f, folderId });
      driveFileId = result.fileId;
      console.log("[AddMemory] Drive upload complete:", driveFileId);
    }

    // Generate thumbnail
    setUploadStatus("Generating thumbnail...");
    if (f.type.startsWith("image/")) {
      thumbUrl = await generateAndUploadThumbnail(f, entryId);
    } else if (f.type.startsWith("video/")) {
      thumbUrl = await generateVideoThumbnail(f, entryId);
    }

    return { driveFileId, thumbUrl };
  };

  /** Upload audio file to Supabase storage. Returns { storagePath, publicUrl } */
  const uploadAudioFile = async (audioF: File, entryId: string) => {
    setUploadStatus("Uploading audio...");
    return await uploadAudio(audioF, entryId);
  };

  /** Upload secondary images in parallel. */
  const uploadSecondaryImagesInline = async (entryId: string, files: File[], folderId: string | null, startIndex: number) => {
    const total = files.length;
    let completed = 0;
    console.log("[AddMemory] Uploading", total, "secondary images in parallel");

    await Promise.all(files.map(async (f, i) => {
      let driveFileId: string | undefined;
      if (folderId) {
        try {
          const result = await uploadToDrive.mutateAsync({ file: f, folderId });
          driveFileId = result.fileId;
        } catch (e) {
          console.warn("[AddMemory] Secondary Drive upload failed:", f.name, e);
        }
      }
      const thumbUrl = await generateAndUploadThumbnail(f, `${entryId}-secondary-${startIndex + i}`);
      await supabase.from("entry_images").insert({
        entry_id: entryId,
        drive_file_id: driveFileId || null,
        thumbnail_url: thumbUrl,
        file_name: f.name,
        sort_order: startIndex + i,
      });
      completed++;
      setUploadStatus(`Uploading additional photos (${completed}/${total})...`);
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Stop recording if still going
    if (recorder.isRecording) recorder.stop();

    const effectiveAudio = getEffectiveAudioFile();

    if (!selectedBabyId) {
      toast({ title: "Select a child", description: "Please choose which child this memory is for.", variant: "destructive" });
      return;
    }

    if (!isEditing && !file && !effectiveAudio && !description.trim()) {
      toast({ title: "Add content", description: "Please add a file, audio, or description for this memory.", variant: "destructive" });
      return;
    }

    // Capture form values before any async work
    const formData = {
      babyId: selectedBabyId,
      description: description.trim() || null,
      date,
      postType,
      tags: [...selectedTags],
      file,
      effectiveAudio,
      secondaryFiles: [...secondaryFiles],
      removeExistingFile,
      removeExistingAudio,
      removeSecondaryIds: [...removeSecondaryIds],
      folderId: selectedBaby?.drive_folder_id || null,
    };

    setIsUploading(true);
    setUploadStatus("Saving...");

    try {
      if (isEditing) {
        await handleEditSubmit(formData);
      } else {
        await handleCreateSubmit(formData);
      }

      // All uploads done — close dialog
      setUploadStatus("Finishing up...");
      resetForm();
      onOpenChange(false);
      toast({ title: "Memory saved!", description: "All files uploaded successfully." });
    } catch (error: unknown) {
      console.error("[AddMemory] Upload error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save memory",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setUploadStatus("");
    }
  };

  const handleCreateSubmit = async (formData: {
    babyId: string;
    description: string | null;
    date: string;
    postType: string;
    tags: string[];
    file: File | null;
    effectiveAudio: File | null;
    secondaryFiles: File[];
    folderId: string | null;
  }) => {
    let entryType: "photo" | "video" | "audio" | "text" = "text";
    if (formData.file) entryType = getFileType(formData.file.type);

    // 1. Create entry in DB
    setUploadStatus("Creating entry...");
    const newEntry = await createEntry.mutateAsync({
      entry: {
        baby_id: formData.babyId,
        type: entryType,
        post_type: formData.postType,
        description: formData.description,
        date: formData.date,
        file_name: formData.file?.name,
        file_size: formData.file?.size,
        mime_type: formData.file?.type,
        created_by: user?.id,
        app_version: APP_VERSION,
      } as any,
      tagIds: formData.tags,
    });

    if (!newEntry?.id) throw new Error("Failed to create entry");

    // 2. Run uploads in parallel
    const uploads: Promise<void>[] = [];

    // Primary file: Drive upload + thumbnail
    if (formData.file) {
      uploads.push(
        uploadPrimaryFile(formData.file, newEntry.id, formData.folderId).then(async ({ driveFileId, thumbUrl }) => {
          await updateEntry.mutateAsync({
            entryId: newEntry.id,
            entry: {
              drive_file_id: driveFileId,
              thumbnail_url: thumbUrl,
            },
          });
        })
      );
    }

    // Audio
    if (formData.effectiveAudio) {
      uploads.push(
        uploadAudioFile(formData.effectiveAudio, newEntry.id).then(async ({ storagePath, publicUrl }) => {
          await updateEntry.mutateAsync({
            entryId: newEntry.id,
            entry: { audio_storage_path: storagePath, audio_url: publicUrl, audio_file_name: formData.effectiveAudio!.name, audio_file_size: formData.effectiveAudio!.size } as any,
          });
        })
      );
    }

    // Secondary images
    if (formData.secondaryFiles.length > 0) {
      uploads.push(
        uploadSecondaryImagesInline(newEntry.id, formData.secondaryFiles, formData.folderId, 0)
      );
    }

    if (uploads.length > 0) {
      await Promise.all(uploads);
    }
  };

  const handleEditSubmit = async (formData: {
    babyId: string;
    description: string | null;
    date: string;
    postType: string;
    tags: string[];
    file: File | null;
    effectiveAudio: File | null;
    secondaryFiles: File[];
    removeExistingFile: boolean;
    removeExistingAudio: boolean;
    removeSecondaryIds: string[];
    folderId: string | null;
  }) => {
    const entry = editEntry!;

    // 1. Update metadata
    setUploadStatus("Updating entry...");
    const entryUpdate: Record<string, any> = {
      baby_id: formData.babyId,
      description: formData.description,
      date: formData.date,
      post_type: formData.postType,
      app_version: APP_VERSION,
    };

    if (formData.removeExistingFile && !formData.file) {
      entryUpdate.type = "text";
      entryUpdate.drive_file_id = null;
      entryUpdate.file_name = null;
      entryUpdate.file_size = null;
      entryUpdate.mime_type = null;
      entryUpdate.thumbnail_url = null;
    }

    await updateEntry.mutateAsync({ entryId: entry.id, entry: entryUpdate, tagIds: formData.tags });

    // 2. Handle file changes
    const hadFile = !!entry.drive_file_id || !!entry.file_name;

    // Delete old file from Drive if replacing or removing
    if (hadFile && (formData.file || formData.removeExistingFile)) {
      if (entry.drive_file_id) {
        try { await deleteFromDrive.mutateAsync(entry.drive_file_id); } catch (e) { console.warn(e); }
      }
      if (!formData.file) {
        try { await deleteThumbnail(entry.id); } catch (e) { console.warn(e); }
      }
    }

    // Upload new primary file
    if (formData.file) {
      const { driveFileId, thumbUrl } = await uploadPrimaryFile(formData.file, entry.id, formData.folderId);
      await updateEntry.mutateAsync({
        entryId: entry.id,
        entry: {
          type: getFileType(formData.file.type),
          drive_file_id: driveFileId || null,
          file_name: formData.file.name,
          file_size: formData.file.size,
          mime_type: formData.file.type,
          thumbnail_url: thumbUrl,
        },
      });
    }

    // 3. Handle audio
    await handleAudioUpdate(entry.id, entry, formData.effectiveAudio, formData.removeExistingAudio);

    // 4. Handle secondary images
    await handleSecondaryImagesUpdate(entry.id, entry, formData.secondaryFiles, formData.removeSecondaryIds, formData.folderId);
  };

  const handleAudioUpdate = async (entryId: string, entry: EntryWithTags, effectiveAudio: File | null, shouldRemove: boolean) => {
    const hadAudio = !!(entry as any).audio_storage_path;
    if (hadAudio && (effectiveAudio || shouldRemove)) {
      try { await deleteAudio((entry as any).audio_storage_path); } catch (e) { console.warn(e); }
    }
    if (effectiveAudio) {
      const { storagePath, publicUrl } = await uploadAudioFile(effectiveAudio, entryId);
      await updateEntry.mutateAsync({ entryId, entry: { audio_storage_path: storagePath, audio_url: publicUrl, audio_file_name: effectiveAudio.name, audio_file_size: effectiveAudio.size } as any });
    } else if (shouldRemove && hadAudio) {
      await updateEntry.mutateAsync({ entryId, entry: { audio_storage_path: null, audio_url: null, audio_file_name: null, audio_file_size: null } as any });
    }
  };

  const handleSecondaryImagesUpdate = async (entryId: string, entry: EntryWithTags, newFiles: File[], removeIds: string[], folderId: string | null) => {
    if (removeIds.length > 0) {
      setUploadStatus("Removing images...");
      for (const imgId of removeIds) {
        const img = entry.entry_images?.find((ei) => ei.id === imgId);
        if (img?.drive_file_id) { try { await deleteFromDrive.mutateAsync(img.drive_file_id); } catch (e) { console.warn(e); } }
        await supabase.from("entry_images").delete().eq("id", imgId);
      }
    }
    if (newFiles.length > 0) {
      const existingCount = (entry.entry_images?.length ?? 0) - removeIds.length;
      const filesToUpload = newFiles.slice(0, 4 - existingCount);
      await uploadSecondaryImagesInline(entryId, filesToUpload, folderId, existingCount);
    }
  };


  const handleSecondaryFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const existingCount = isEditing
      ? (editEntry?.entry_images?.length ?? 0) - removeSecondaryIds.length
      : 0;
    const currentCount = existingCount + secondaryFiles.length;
    const remaining = 4 - currentCount;
    if (remaining <= 0) {
      toast({ title: "Limit reached", description: "Maximum 4 secondary images.", variant: "destructive" });
      return;
    }
    setSecondaryFiles((prev) => [...prev, ...files.slice(0, remaining)]);
    if (secondaryInputRef.current) secondaryInputRef.current.value = "";
  };

  const TypeIcon = file ? typeIcons[getFileType(file.type)] : Upload;
  const existingAudioName = isEditing ? (editEntry as any)?.audio_file_name : null;
  const hasRecording = !!recorder.blob;
  const hasAnyAudio = !!audioFile || hasRecording;

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

          {/* Entry Type */}
          <div>
            <label className="text-sm font-medium mb-2 block">Entry Type</label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={postType === "standard" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setPostType("standard")}
              >
                <FileText className="h-4 w-4 mr-1.5" />
                Standard
              </Button>
              <Button
                type="button"
                variant={postType === "dialogue" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setPostType("dialogue")}
              >
                <Quote className="h-4 w-4 mr-1.5" />
                Dialogue / Quote
              </Button>
            </div>
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
                  className="flex-1"
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
          {!isEditing && !hasAnyAudio && !recorder.isRecording && (
            <div>
              <label className="text-sm font-medium mb-2 block">Audio (optional)</label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => recorder.start()}
                  className="flex-1"
                >
                  <Circle className="h-4 w-4 mr-2 text-red-500 fill-red-500" />
                  Record
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => audioInputRef.current?.click()}
                  title="Attach audio file"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Recording in progress */}
          {!isEditing && recorder.isRecording && (
            <div>
              <label className="text-sm font-medium mb-2 block">Recording...</label>
              <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 p-3">
                <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                <span className="text-sm font-mono flex-1">{formatDuration(recorder.duration)}</span>
                {recorder.isPaused ? (
                  <Button type="button" variant="outline" size="sm" onClick={recorder.resume}>
                    Resume
                  </Button>
                ) : (
                  <Button type="button" variant="outline" size="sm" onClick={recorder.pause}>
                    Pause
                  </Button>
                )}
                <Button type="button" variant="default" size="sm" onClick={recorder.stop}>
                  <Square className="h-3 w-3 mr-1 fill-current" />
                  Stop
                </Button>
              </div>
            </div>
          )}

          {/* Recording done — show preview */}
          {!isEditing && hasRecording && !recorder.isRecording && !audioFile && (
            <div>
              <label className="text-sm font-medium mb-2 block">Recorded audio</label>
              <div className="flex items-center gap-2">
                <audio
                  controls
                  src={URL.createObjectURL(recorder.blob!)}
                  className="flex-1 h-8"
                  preload="metadata"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={recorder.discard}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Audio file chosen (not recording) */}
          {!isEditing && audioFile && (
            <div>
              <label className="text-sm font-medium mb-2 block">Audio file</label>
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
                  onClick={() => {
                    setAudioFile(null);
                    if (audioInputRef.current) audioInputRef.current.value = "";
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
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

          {/* ===== Secondary images ===== */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Additional Photos ({(() => {
                const existing = isEditing ? (editEntry?.entry_images?.length ?? 0) - removeSecondaryIds.length : 0;
                return existing + secondaryFiles.length;
              })()}/4, optional)
            </label>
            <Input
              ref={secondaryInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleSecondaryFilesChange}
              className="hidden"
            />
            {/* Existing secondary images (edit mode) */}
            {isEditing && editEntry?.entry_images && editEntry.entry_images.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {editEntry.entry_images
                  .filter((img) => !removeSecondaryIds.includes(img.id))
                  .map((img) => (
                    <div key={img.id} className="relative w-16 h-16 rounded overflow-hidden border">
                      {img.thumbnail_url && (
                        <img src={img.thumbnail_url} alt="" className="w-full h-full object-cover" />
                      )}
                      <button
                        type="button"
                        className="absolute top-0 right-0 bg-black/60 rounded-bl p-0.5"
                        onClick={() => setRemoveSecondaryIds((prev) => [...prev, img.id])}
                      >
                        <X className="h-3 w-3 text-white" />
                      </button>
                    </div>
                  ))}
              </div>
            )}
            {/* New secondary files */}
            {secondaryFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {secondaryFiles.map((f, i) => (
                  <div key={i} className="relative w-16 h-16 rounded overflow-hidden border bg-muted flex items-center justify-center">
                    <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      className="absolute top-0 right-0 bg-black/60 rounded-bl p-0.5"
                      onClick={() => setSecondaryFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      <X className="h-3 w-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {(() => {
              const existing = isEditing ? (editEntry?.entry_images?.length ?? 0) - removeSecondaryIds.length : 0;
              const total = existing + secondaryFiles.length;
              if (total < 4) {
                return (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => secondaryInputRef.current?.click()}
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add photos
                  </Button>
                );
              }
              return null;
            })()}
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium mb-2 block">Description</label>
            <Textarea
              dir="auto"
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
          <Button type="submit" className="w-full" disabled={isUploading || !babies?.length || recorder.isRecording}>
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {uploadStatus || "Saving..."}
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
