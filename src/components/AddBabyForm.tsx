import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCreateBaby, useUpdateBaby } from "@/hooks/useBabies";
import { useCreateDriveFolder, useGoogleConnection } from "@/hooks/useGoogleDrive";
import { toast } from "@/hooks/use-toast";
import { Baby, Loader2, Plus } from "lucide-react";

export function AddBabyForm() {
  const [name, setName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  
  const { data: googleConnection } = useGoogleConnection();
  const createBaby = useCreateBaby();
  const updateBaby = useUpdateBaby();
  const createFolder = useCreateDriveFolder();
  
  const isConnected = !!googleConnection?.refresh_token;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for the baby.",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    
    try {
      // Create baby record first
      const baby = await createBaby.mutateAsync({ name: name.trim() });
      
      // If Google Drive is connected, create folder
      if (isConnected) {
        try {
          const { folderId } = await createFolder.mutateAsync(`BabyJournal/${name.trim()}`);
          await updateBaby.mutateAsync({ id: baby.id, drive_folder_id: folderId });
          
          toast({
            title: "Baby Added!",
            description: `${name} has been added with a Google Drive folder.`,
          });
        } catch (folderError) {
          toast({
            title: "Baby Added (without folder)",
            description: `${name} was added, but folder creation failed. You can try again later.`,
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Baby Added!",
          description: `${name} has been added. Connect Google Drive to enable media uploads.`,
        });
      }
      
      setName("");
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add baby",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Baby className="h-5 w-5" />
          Add a Baby
        </CardTitle>
        <CardDescription>
          Create a profile for your little one
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            placeholder="Baby's name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isCreating}
          />
          <Button type="submit" disabled={isCreating}>
            {isCreating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </Button>
        </form>
        {!isConnected && (
          <p className="text-xs text-muted-foreground mt-2">
            Connect Google Drive to automatically create folders for each baby
          </p>
        )}
      </CardContent>
    </Card>
  );
}
