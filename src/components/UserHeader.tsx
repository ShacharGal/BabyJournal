import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, Eye } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export function UserHeader() {
  const { user, logout, canEdit } = useAuth();

  if (!user) return null;

  return (
    <div className="flex items-center gap-3">
      {!canEdit && (
        <Badge variant="secondary" className="gap-1">
          <Eye className="h-3 w-3" />
          View only
        </Badge>
      )}
      <span className="text-sm font-medium">{user.nickname}</span>
      <Button variant="ghost" size="sm" onClick={logout}>
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );
}
