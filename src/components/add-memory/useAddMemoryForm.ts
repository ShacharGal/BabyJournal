import { useState, useRef, useEffect } from "react";
import { useBabies } from "@/hooks/useBabies";
import { useCreateEntry, useUpdateEntry, type EntryWithTags } from "@/hooks/useEntries";
import { useGoogleConnection, useUploadToDrive, useDeleteFromDrive } from "@/hooks/useGoogleDrive";
import { toast } from "@/hooks/use-toast";
import { useAuthContext } from "@/contexts/AuthContext";
import { generateAndUploadThumbnail, deleteThumbnail, generateVideoThumbnail } from "@/lib/thumbnails";
import { uploadAudio, deleteAudio } from "@/lib/audioUpload";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { extractDateFromFile } from "@/lib/exifDate";
import { supabase } from "@/integrations/supabase/client";
import { APP_VERSION } from "@/main";

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const getFileType = (mimeType: string): "photo" | "video" | "audio" | "text" => {
  if (mimeType.startsWith("image/")) return "photo";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "text";
};

interface UseAddMemoryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preSelectedBabyId?: string;
  editEntry?: EntryWithTags | null;
}

export function useAddMemoryForm({ open, onOpenChange, preSelectedBabyId, editEntry }: UseAddMemoryFormProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

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
  const existingAudioName = isEditing ? (editEntry as any)?.audio_file_name : null;
  const hasRecording = !!recorder.blob;
  const hasAnyAudio = !!audioFile || hasRecording;

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
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (audioInputRef.current) audioInputRef.current.value = "";
    recorder.discard();
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleCameraFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    console.log("[AddMemory] Camera files selected:", files.length, files.map(f => f.name));
    if (files.length === 0) return;

    // First file is primary
    const primary = files[0];
    console.log("[AddMemory] Setting primary file:", primary.name, primary.type);
    setFile(primary);

    // Try to extract date from EXIF
    const exifDate = await extractDateFromFile(primary);
    if (exifDate) setDate(exifDate);

    // Remaining files are secondary (up to 4)
    if (files.length > 1) {
      const existingCount = isEditing
        ? (editEntry?.entry_images?.length ?? 0) - removeSecondaryIds.length
        : 0;
      const currentSecondaryCount = existingCount + secondaryFiles.length;
      const remaining = 4 - currentSecondaryCount;
      const newSecondary = files.slice(1, 1 + remaining);
      setSecondaryFiles((prev) => [...prev, ...newSecondary]);
    }

    // Reset input so same file can be re-selected
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) setAudioFile(selectedFile);
    if (audioInputRef.current) audioInputRef.current.value = "";
  };

  const removePrimaryFile = () => {
    setFile(null);
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const removeExistingPrimaryFile = () => {
    setRemoveExistingFile(true);
  };

  const undoRemoveExistingFile = () => {
    setFile(null);
    setRemoveExistingFile(false);
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const removeSecondaryAtIndex = (index: number) => {
    setSecondaryFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const markSecondaryForRemoval = (imgId: string) => {
    setRemoveSecondaryIds((prev) => [...prev, imgId]);
  };

  const removeAudio = () => {
    setAudioFile(null);
    recorder.discard();
    if (audioInputRef.current) audioInputRef.current.value = "";
  };

  const removeExistingAudioFile = () => {
    setRemoveExistingAudio(true);
  };

  const undoRemoveExistingAudio = () => {
    setRemoveExistingAudio(false);
  };

  // ── Upload helpers ──

  const getEffectiveAudioFile = (): File | null => {
    if (audioFile) return audioFile;
    if (recorder.blob) {
      return new File([recorder.blob], `recording-${Date.now()}.webm`, { type: "audio/webm" });
    }
    return null;
  };

  const uploadPrimaryFile = async (f: File, entryId: string, folderId: string | null): Promise<{ driveFileId: string | null; thumbUrl: string | null }> => {
    let driveFileId: string | null = null;
    let thumbUrl: string | null = null;

    if (folderId) {
      setUploadStatus(f.type.startsWith("video/") ? "Uploading video..." : "Uploading photo...");
      const result = await uploadToDrive.mutateAsync({ file: f, folderId });
      driveFileId = result.fileId;
      console.log("[AddMemory] Drive upload complete:", driveFileId);
    }

    setUploadStatus("Generating thumbnail...");
    if (f.type.startsWith("image/")) {
      thumbUrl = await generateAndUploadThumbnail(f, entryId);
    } else if (f.type.startsWith("video/")) {
      thumbUrl = await generateVideoThumbnail(f, entryId);
    }

    return { driveFileId, thumbUrl };
  };

  const uploadAudioFile = async (audioF: File, entryId: string) => {
    setUploadStatus("Uploading audio...");
    return await uploadAudio(audioF, entryId);
  };

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

  // ── Submit ──

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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

    const uploads: Promise<void>[] = [];

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

    const hadFile = !!entry.drive_file_id || !!entry.file_name;

    if (hadFile && (formData.file || formData.removeExistingFile)) {
      if (entry.drive_file_id) {
        try { await deleteFromDrive.mutateAsync(entry.drive_file_id); } catch (e) { console.warn(e); }
      }
      if (!formData.file) {
        try { await deleteThumbnail(entry.id); } catch (e) { console.warn(e); }
      }
    }

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

    await handleAudioUpdate(entry.id, entry, formData.effectiveAudio, formData.removeExistingAudio);
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

  return {
    // State
    selectedBabyId, setSelectedBabyId,
    description, setDescription,
    date, setDate,
    postType, setPostType,
    selectedTags, toggleTag,
    file, secondaryFiles, audioFile,
    removeExistingFile, removeExistingAudio, removeSecondaryIds,
    isUploading, uploadStatus,
    recorder,
    // Derived
    babies, selectedBaby, isEditing, isConnected, editEntry,
    existingAudioName, hasRecording, hasAnyAudio,
    // Refs
    cameraInputRef, audioInputRef,
    // Handlers
    handleCameraFilesChange,
    handleAudioChange,
    handleSubmit,
    removePrimaryFile,
    removeExistingPrimaryFile,
    undoRemoveExistingFile,
    removeSecondaryAtIndex,
    markSecondaryForRemoval,
    removeAudio,
    removeExistingAudioFile,
    undoRemoveExistingAudio,
  };
}

export type AddMemoryFormReturn = ReturnType<typeof useAddMemoryForm>;
