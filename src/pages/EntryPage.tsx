import { useParams, useNavigate } from "react-router-dom";
import { Loader2, AlertTriangle } from "lucide-react";
import { MemoryDetailView } from "@/components/MemoryDetailView";
import { useEntryById, useDeleteEntry } from "@/hooks/useEntries";
import { useBabies } from "@/hooks/useBabies";
import { useFavoriteIds, useToggleFavorite } from "@/hooks/useFavorites";
import { useAllNicknames } from "@/hooks/useEntries";
import { useAuthContext } from "@/contexts/AuthContext";

export default function EntryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, canEdit, canAdd } = useAuthContext();

  const { data: entry, isLoading, isError } = useEntryById(id ?? "");
  const { data: babies = [] } = useBabies();
  const { data: favoriteIds = new Set<string>() } = useFavoriteIds(user?.id);
  const toggleFavorite = useToggleFavorite();
  const deleteEntry = useDeleteEntry();
  const { data: allNicknames = [] } = useAllNicknames();

  const getBabyName = (babyId: string) =>
    babies.find((b) => b.id === babyId)?.name ?? "";
  const getBabyDob = (babyId: string) =>
    babies.find((b) => b.id === babyId)?.dob ?? null;

  const handleClose = () => navigate("/", { replace: true });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !entry) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <AlertTriangle className="h-8 w-8" />
        <p>Memory not found.</p>
        <button className="text-sm underline" onClick={handleClose}>Go home</button>
      </div>
    );
  }

  const canEditThis = canEdit || (canAdd && !!user && entry.created_by === user.id);

  return (
    <MemoryDetailView
      entry={entry}
      babyName={getBabyName(entry.baby_id)}
      babyDob={getBabyDob(entry.baby_id)}
      canEdit={canEditThis}
      onClose={handleClose}
      onEdit={() => {
        // Navigate home and let the user edit from there
        navigate("/", { replace: true });
      }}
      onDelete={(entryId) => {
        deleteEntry.mutate(entryId);
        navigate("/", { replace: true });
      }}
      isFavorited={favoriteIds.has(entry.id)}
      onToggleFavorite={() => {
        if (!user?.id) return;
        toggleFavorite.mutate({
          entryId: entry.id,
          userId: user.id,
          isFavorited: favoriteIds.has(entry.id),
        });
      }}
      nicknames={allNicknames}
    />
  );
}
