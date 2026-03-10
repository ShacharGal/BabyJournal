import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type Tag = Tables<"tags">;
export type TagInsert = TablesInsert<"tags">;

export function useTags() {
  return useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tags")
        .select("*")
        .order("name", { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });
}

export function useUsedTags() {
  return useQuery({
    queryKey: ["used-tags"],
    queryFn: async () => {
      const { data: entryTags, error: etError } = await supabase
        .from("entry_tags")
        .select("tag_id");
      if (etError) throw etError;

      const usedIds = Array.from(new Set((entryTags ?? []).map((et) => et.tag_id)));
      if (usedIds.length === 0) return [];

      const { data: tags, error: tError } = await supabase
        .from("tags")
        .select("*")
        .in("id", usedIds)
        .order("name", { ascending: true });
      if (tError) throw tError;
      return tags;
    },
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (tag: TagInsert) => {
      const { data, error } = await supabase
        .from("tags")
        .insert(tag)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
  });
}
