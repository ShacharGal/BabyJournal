import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type Baby = Tables<"babies">;
export type BabyInsert = TablesInsert<"babies">;

export function useBabies() {
  return useQuery({
    queryKey: ["babies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("babies")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateBaby() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (baby: BabyInsert) => {
      const { data, error } = await supabase
        .from("babies")
        .insert(baby)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["babies"] });
    },
  });
}

export function useUpdateBaby() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Baby> & { id: string }) => {
      const { data, error } = await supabase
        .from("babies")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["babies"] });
    },
  });
}
