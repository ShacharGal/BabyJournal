import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Permission = "full" | "add" | "view_only";

export interface User {
  id: string;
  nickname: string;
  permission: Permission;
}

const STORAGE_KEY = "baby_journal_user";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.functions.invoke("login", {
        body: { password },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.error) {
        return { success: false, error: data.error };
      }

      const userData: User = {
        id: data.id,
        nickname: data.nickname,
        permission: data.permission,
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
      setUser(userData);

      return { success: true };
    } catch (err) {
      return { success: false, error: "Login failed. Please try again." };
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  const canAdd = user?.permission === "full" || user?.permission === "add";
  const canEdit = user?.permission === "full";

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    canAdd,
    canEdit,
    login,
    logout,
  };
}
