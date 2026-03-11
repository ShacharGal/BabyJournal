import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { EntryWithTags } from "@/hooks/useEntries";

export function useFavoriteIds(userId: string | undefined) {
  return useQuery({
    queryKey: ["favorites", userId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("entry_favorites")
        .select("entry_id")
        .eq("user_id", userId);
      if (error) throw error;
      return new Set<string>((data ?? []).map((r: any) => r.entry_id as string));
    },
    enabled: !!userId,
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      entryId,
      userId,
      isFavorited,
    }: {
      entryId: string;
      userId: string;
      isFavorited: boolean;
    }) => {
      if (isFavorited) {
        const { error } = await (supabase as any)
          .from("entry_favorites")
          .delete()
          .eq("entry_id", entryId)
          .eq("user_id", userId);
        if (error) {
          console.error("[Favorites] Delete error:", error);
          throw error;
        }
      } else {
        const { error } = await (supabase as any)
          .from("entry_favorites")
          .insert({ entry_id: entryId, user_id: userId });
        if (error) {
          console.error("[Favorites] Insert error:", error);
          throw error;
        }
      }
      console.log(`[Favorites] ${isFavorited ? "Removed" : "Added"} entry ${entryId}`);
    },
    onMutate: async ({ entryId, userId, isFavorited }) => {
      await queryClient.cancelQueries({ queryKey: ["favorites", userId] });
      const previous = queryClient.getQueryData<Set<string>>(["favorites", userId]);
      queryClient.setQueryData<Set<string>>(["favorites", userId], (old = new Set()) => {
        const next = new Set(old);
        if (isFavorited) {
          next.delete(entryId);
        } else {
          next.add(entryId);
        }
        return next;
      });
      return { previous };
    },
    onError: (_err, variables, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(["favorites", variables.userId], context.previous);
      }
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: ["favorites", variables.userId] });
    },
  });
}

export function useFavoritedEntries(userId: string | undefined, favoriteIds: Set<string>) {
  return useQuery({
    queryKey: ["favorited-entries", userId, [...favoriteIds].sort().join(",")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entries")
        .select("*, entry_tags(tag_id, tags(*)), entry_images(*)")
        .in("id", [...favoriteIds])
        .order("date", { ascending: false });
      if (error) throw error;

      const rows = data as any[];
      const creatorIds = Array.from(
        new Set(rows.map((row) => row.created_by).filter(Boolean))
      ) as string[];

      const nicknameByUserId = new Map<string, string>();
      if (creatorIds.length > 0) {
        const { data: creators, error: creatorsError } = await supabase
          .from("app_users_public" as any)
          .select("id, nickname")
          .in("id", creatorIds);
        if (creatorsError) throw creatorsError;
        (creators ?? []).forEach((creator: any) => {
          nicknameByUserId.set(creator.id, creator.nickname);
        });
      }

      return rows.map((row) => ({
        ...row,
        created_by_nickname: row.created_by
          ? nicknameByUserId.get(row.created_by) ?? null
          : null,
      })) as EntryWithTags[];
    },
    enabled: !!userId && favoriteIds.size > 0,
  });
}
