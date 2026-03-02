import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useBabies } from "@/hooks/useBabies";
import { useCreateEntry } from "@/hooks/useEntries";
import { useTags } from "@/hooks/useTags";
import { useGoogleConnection, useUploadToDrive } from "@/hooks/useGoogleDrive";
import { toast } from "@/hooks/use-toast";
import { Upload, Loader2, X, Image, Video, Mic, FileText } from "lucide-react";

const typeIcons = {
  photo: Image,
  video: Video,
  audio: Mic,
  text: FileText,
};

export function UploadEntryForm() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedBabyId, setSelectedBabyId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const { data: babies } = useBabies();
  const { data: tags } = useTags();
  const { data: googleConnection } = useGoogleConnection();
  const createEntry = useCreateEntry();
  const uploadToDrive = useUploadToDrive();
  
  const isConnected = !!googleConnection?.refresh_token;
  const selectedBaby = babies?.find(b => b.id === selectedBabyId);

  const getFileType = (mimeType: string): "photo" | "video" | "audio" | "text" => {
    if (mimeType.startsWith("image/")) return "photo";
    if (mimeType.startsWith("video/")) return "video";
    if (mimeType.startsWith("audio/")) return "audio";
    return "text";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedBabyId) {
      toast({
        title: "Select a baby",
        description: "Please choose which baby this memory is for.",
        variant: "destructive",
      });
      return;
    }

    if (!file && !description.trim()) {
      toast({
        title: "Add content",
        description: "Please add a file or description for this memory.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      let driveFileId: string | undefined;
      let thumbnailUrl: string | undefined;
      let entryType: "photo" | "video" | "audio" | "text" = "text";

      // Upload file to Google Drive if available
      if (file && isConnected && selectedBaby?.drive_folder_id) {
        const result = await uploadToDrive.mutateAsync({
          file,
          folderId: selectedBaby.drive_folder_id,
        });
        driveFileId = result.fileId;
        thumbnailUrl = result.thumbnailUrl;
        entryType = getFileType(file.type);
      } else if (file) {
        entryType = getFileType(file.type);
      }

      // Create entry in database
      await createEntry.mutateAsync({
        entry: {
          baby_id: selectedBabyId,
          type: entryType,
          description: description.trim() || null,
          date,
          drive_file_id: driveFileId,
          thumbnail_url: thumbnailUrl,
          file_name: file?.name,
          file_size: file?.size,
          mime_type: file?.type,
        },
        tagIds: selectedTags,
      });

      toast({
        title: "Memory saved!",
        description: driveFileId 
          ? "Your memory has been saved and uploaded to Google Drive."
          : "Your memory has been saved.",
      });

      // Reset form
      setDescription("");
      setFile(null);
      setSelectedTags([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Add Memory
        </CardTitle>
        <CardDescription>
          Upload a photo, video, audio, or text entry
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Baby Selection */}
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
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* File Upload */}
          <div>
            <label className="text-sm font-medium mb-2 block">File (optional)</label>
            <div className="flex items-center gap-2">
              <Input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,audio/*"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
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
            <div className="flex flex-wrap gap-2">
              {tags?.map((tag) => (
                <Badge
                  key={tag.id}
                  variant={selectedTags.includes(tag.id) ? "default" : "outline"}
                  className="cursor-pointer transition-colors"
                  style={{
                    backgroundColor: selectedTags.includes(tag.id) ? tag.color || undefined : undefined,
                    borderColor: tag.color || undefined,
                  }}
                  onClick={() => toggleTag(tag.id)}
                >
                  {tag.name}
                </Badge>
              ))}
            </div>
          </div>

          {/* Submit */}
          <Button type="submit" className="w-full" disabled={isUploading || !babies?.length}>
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Save Memory
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
