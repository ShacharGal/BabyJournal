import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCreateBaby, useUpdateBaby } from "@/hooks/useBabies";
import { useCreateDriveFolder, useGoogleConnection } from "@/hooks/useGoogleDrive";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, Loader2, Plus, Users } from "lucide-react";

export function AddChildForm() {
  const [name, setName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState<Date>();
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
        description: "Please enter a name for the child.",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    
    try {
      const baby = await createBaby.mutateAsync({
        name: name.trim(),
        date_of_birth: dateOfBirth ? format(dateOfBirth, "yyyy-MM-dd") : null,
      });
      
      if (isConnected) {
        try {
          const { folderId } = await createFolder.mutateAsync(`BabyJournal/${name.trim()}`);
          await updateBaby.mutateAsync({ id: baby.id, drive_folder_id: folderId });
          
          toast({
            title: "Child Added!",
            description: `${name} has been added with a Google Drive folder.`,
          });
        } catch (folderError) {
          toast({
            title: "Child Added (without folder)",
            description: `${name} was added, but folder creation failed. You can try again later.`,
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Child Added!",
          description: `${name} has been added. Connect Google Drive to enable media uploads.`,
        });
      }
      
      setName("");
      setDateOfBirth(undefined);
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add child",
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
          <Users className="h-5 w-5" />
          Add a Child
        </CardTitle>
        <CardDescription>
          Create a profile for your little one
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Child's name"
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
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                type="button"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !dateOfBirth && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateOfBirth ? format(dateOfBirth, "PPP") : "Date of birth (optional)"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateOfBirth}
                onSelect={setDateOfBirth}
                disabled={(date) => date > new Date()}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          {!isConnected && (
            <p className="text-xs text-muted-foreground">
              Connect Google Drive to automatically create folders for each child
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
