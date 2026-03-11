import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Heart, Loader2 } from "lucide-react";
import { useAuthContext } from "@/contexts/AuthContext";
import { useBabies } from "@/hooks/useBabies";
import { useFavoriteIds, useFavoritedEntries, useToggleFavorite } from "@/hooks/useFavorites";
import { MemoryCard } from "@/components/MemoryFeed";
import { MemoryDetailView } from "@/components/MemoryDetailView";
import type { EntryWithTags } from "@/hooks/useEntries";

interface FavoritesViewProps {
  onClose: () => void;
}

export function FavoritesView({ onClose }: FavoritesViewProps) {
  const { user, canEdit, canAdd } = useAuthContext();
  const { data: babies } = useBabies();
  const { data: favoriteIds = new Set<string>(), isLoading: loadingIds } = useFavoriteIds(user?.id);
  const { data: entries, isLoading: loadingEntries } = useFavoritedEntries(user?.id, favoriteIds);
  const toggleFavorite = useToggleFavorite();
  const [detailEntry, setDetailEntry] = useState<EntryWithTags | null>(null);

  const getBabyName = (id: string) => babies?.find((b) => b.id === id)?.name || "Unknown";
  const getBabyDob = (id: string) => babies?.find((b) => b.id === id)?.date_of_birth || null;

  const isLoading = loadingIds || (favoriteIds.size > 0 && loadingEntries);

  return (
    <div className="fixed inset-0 z-50 bg-black/10 backdrop-blur-[15px] overflow-y-auto">
      {/* Top bar */}
      <div className="sticky top-0 z-10 flex items-center gap-3 p-3 bg-white/60 backdrop-blur-[12px] border-b border-white/80">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <span className="font-semibold text-base">Favourites</span>
      </div>

      <div className="mx-auto max-w-[600px] px-4 py-6 pb-24">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : favoriteIds.size === 0 || !entries || entries.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Heart className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">No favourites yet</p>
            <p className="text-sm mt-1">Tap the heart on any memory to save it here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <MemoryCard
                key={entry.id}
                entry={entry}
                babyName={getBabyName(entry.baby_id)}
                babyDob={getBabyDob(entry.baby_id)}
                showBaby={true}
                onExpand={setDetailEntry}
                isFavorited={favoriteIds.has(entry.id)}
                onToggleFavorite={(entryId) => {
                  if (!user?.id) return;
                  toggleFavorite.mutate({ entryId, userId: user.id, isFavorited: favoriteIds.has(entryId) });
                }}
              />
            ))}
          </div>
        )}
      </div>

      {detailEntry && (
        <MemoryDetailView
          entry={detailEntry}
          babyName={getBabyName(detailEntry.baby_id)}
          babyDob={getBabyDob(detailEntry.baby_id)}
          canEdit={canEdit || (canAdd && !!user && detailEntry.created_by === user.id)}
          onClose={() => setDetailEntry(null)}
          onEdit={() => setDetailEntry(null)}
          onDelete={() => setDetailEntry(null)}
          isFavorited={favoriteIds.has(detailEntry.id)}
          onToggleFavorite={() => {
            if (!user?.id) return;
            toggleFavorite.mutate({ entryId: detailEntry.id, userId: user.id, isFavorited: favoriteIds.has(detailEntry.id) });
          }}
        />
      )}
    </div>
  );
}
