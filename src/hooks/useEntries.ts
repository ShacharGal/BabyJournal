import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { useDeleteFromDrive } from "@/hooks/useGoogleDrive";

export type Entry = Tables<"entries">;
export type EntryInsert = TablesInsert<"entries">;

export type EntryWithTags = Entry & {
  entry_tags: Array<{
    tag_id: string;
    tags: Tables<"tags">;
  }>;
};

export function useEntries(babyId?: string) {
  return useQuery({
    queryKey: ["entries", babyId],
    queryFn: async () => {
      let query = supabase
        .from("entries")
        .select(`
          *,
          entry_tags (
            tag_id,
            tags (*)
          )
        `)
        .order("date", { ascending: false });
      
      if (babyId) {
        query = query.eq("baby_id", babyId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as EntryWithTags[];
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
        // Remove existing tags then re-insert
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
      // First fetch the entry to get drive_file_id
      const { data: entry } = await supabase
        .from("entries")
        .select("drive_file_id")
        .eq("id", entryId)
        .single();

      // Delete from Drive if there's a file (best-effort, don't block DB delete)
      if (entry?.drive_file_id) {
        try {
          await deleteFromDrive.mutateAsync(entry.drive_file_id);
        } catch (e) {
          console.warn("Failed to delete Drive file:", e);
        }
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
