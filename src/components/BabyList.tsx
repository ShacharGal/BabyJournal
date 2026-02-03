import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useBabies } from "@/hooks/useBabies";
import { Baby, FolderOpen, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface BabyListProps {
  selectedBabyId?: string;
  onSelectBaby: (babyId: string | undefined) => void;
}

export function BabyList({ selectedBabyId, onSelectBaby }: BabyListProps) {
  const { data: babies, isLoading } = useBabies();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Baby className="h-5 w-5" />
            Your Babies
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!babies || babies.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Baby className="h-5 w-5" />
            Your Babies
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No babies added yet. Add your first baby above!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Baby className="h-5 w-5" />
          Your Babies
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <button
          onClick={() => onSelectBaby(undefined)}
          className={`w-full text-left p-3 rounded-lg border transition-colors ${
            selectedBabyId === undefined 
              ? "border-primary bg-primary/5" 
              : "border-transparent hover:bg-muted"
          }`}
        >
          <span className="font-medium">All Babies</span>
        </button>
        
        {babies.map((baby) => (
          <button
            key={baby.id}
            onClick={() => onSelectBaby(baby.id)}
            className={`w-full text-left p-3 rounded-lg border transition-colors ${
              selectedBabyId === baby.id 
                ? "border-primary bg-primary/5" 
                : "border-transparent hover:bg-muted"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{baby.name}</span>
              {baby.drive_folder_id && (
                <Badge variant="outline" className="text-xs">
                  <FolderOpen className="h-3 w-3 mr-1" />
                  Drive
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Added {format(new Date(baby.created_at), "MMM d, yyyy")}
            </p>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
