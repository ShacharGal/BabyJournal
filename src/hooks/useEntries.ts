import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { useDeleteFromDrive } from "@/hooks/useGoogleDrive";
import { deleteThumbnail } from "@/lib/thumbnails";

export type Entry = Tables<"entries">;
export type EntryInsert = TablesInsert<"entries">;

export type EntryWithTags = Entry & {
  created_by_nickname?: string | null;
  entry_tags: Array<{
    tag_id: string;
    tags: Tables<"tags">;
  }>;
};

const PAGE_SIZE = 20;

export function useEntries(babyId?: string) {
  return useInfiniteQuery({
    queryKey: ["entries", babyId],
    queryFn: async ({ pageParam = 0 }) => {
      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("entries")
        .select(`
          *,
          entry_tags (
            tag_id,
            tags (*)
          )
        `)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .range(from, to);

      if (babyId) {
        query = query.eq("baby_id", babyId);
      }

      const { data, error } = await query;
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

      const entries = rows.map((row) => ({
        ...row,
        created_by_nickname: row.created_by
          ? nicknameByUserId.get(row.created_by) ?? null
          : null,
      })) as EntryWithTags[];

      return entries;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.length;
    },
  });
}

export function useCreateEntry() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      entry, 
      tagIds 
    }: { 
      entry: EntryInsert; 
      tagIds?: string[] 
    }) => {
      const { data: newEntry, error: entryError } = await supabase
        .from("entries")
        .insert(entry)
        .select()
        .single();
      
      if (entryError) throw entryError;
      
      if (tagIds && tagIds.length > 0) {
        const entryTags = tagIds.map(tagId => ({
          entry_id: newEntry.id,
          tag_id: tagId,
        }));
        
        const { error: tagError } = await supabase
          .from("entry_tags")
          .insert(entryTags);
        
        if (tagError) throw tagError;
      }
      
      return newEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entries"] });
    },
  });
}

export function useUpdateEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      entryId,
      entry,
      tagIds,
    }: {
      entryId: string;
      entry: Partial<EntryInsert>;
      tagIds?: string[];
    }) => {
      const { data: updated, error: entryError } = await supabase
        .from("entries")
        .update(entry)
        .eq("id", entryId)
        .select()
        .single();

      if (entryError) throw entryError;

      if (tagIds !== undefined) {
        const { error: deleteError } = await supabase
          .from("entry_tags")
          .delete()
          .eq("entry_id", entryId);
        if (deleteError) throw deleteError;

        if (tagIds.length > 0) {
          const entryTags = tagIds.map((tagId) => ({
            entry_id: entryId,
            tag_id: tagId,
          }));
          const { error: tagError } = await supabase
            .from("entry_tags")
            .insert(entryTags);
          if (tagError) throw tagError;
        }
      }

      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entries"] });
    },
  });
}

export function useDeleteEntry() {
  const queryClient = useQueryClient();
  const deleteFromDrive = useDeleteFromDrive();
  
  return useMutation({
    mutationFn: async (entryId: string) => {
      const { data: entry } = await supabase
        .from("entries")
        .select("drive_file_id")
        .eq("id", entryId)
        .single();

      if (entry?.drive_file_id) {
        try {
          await deleteFromDrive.mutateAsync(entry.drive_file_id);
        } catch (e) {
          console.warn("Failed to delete Drive file:", e);
        }
      }

      try {
        await deleteThumbnail(entryId);
      } catch (e) {
        console.warn("Failed to delete thumbnail:", e);
      }

      const { error } = await supabase
        .from("entries")
        .delete()
        .eq("id", entryId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entries"] });
    },
  });
}
