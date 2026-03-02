import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useBabies } from "@/hooks/useBabies";
import { Users, FolderOpen, Loader2 } from "lucide-react";
import { format, differenceInMonths, differenceInYears, differenceInDays } from "date-fns";

function formatAge(dateOfBirth: string): string {
  const dob = new Date(dateOfBirth);
  const now = new Date();
  const months = differenceInMonths(now, dob);
  if (months < 1) {
    const days = differenceInDays(now, dob);
    return `${days} day${days !== 1 ? "s" : ""} old`;
  }
  if (months < 24) {
    return `${months} month${months !== 1 ? "s" : ""} old`;
  }
  const years = differenceInYears(now, dob);
  const rem = months - years * 12;
  return rem > 0
    ? `${years} year${years !== 1 ? "s" : ""}, ${rem} month${rem !== 1 ? "s" : ""} old`
    : `${years} year${years !== 1 ? "s" : ""} old`;
}

interface ChildListProps {
  selectedBabyId?: string;
  onSelectBaby: (babyId: string | undefined) => void;
}

export function ChildList({ selectedBabyId, onSelectBaby }: ChildListProps) {
  const { data: babies, isLoading } = useBabies();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Your Children
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
            <Users className="h-5 w-5" />
            Your Children
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No children added yet. Add your first child above!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Your Children
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
          <span className="font-medium">All Children</span>
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
            {baby.date_of_birth ? (
              <p className="text-xs text-muted-foreground mt-1">
                Born {format(new Date(baby.date_of_birth), "MMM d, yyyy")} · {formatAge(baby.date_of_birth)}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                Added {format(new Date(baby.created_at), "MMM d, yyyy")}
              </p>
            )}
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
