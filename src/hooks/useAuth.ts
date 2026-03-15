import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Permission = "full" | "add" | "view_only";

export interface User {
  id: string;
  nickname: string;
  permission: Permission;
}

const STORAGE_KEY = "baby_journal_user";
const VALIDATE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const logout = useCallback(() => {
    console.log("[Auth] Logging out");
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  const validateSession = useCallback(async (currentUser: User) => {
    try {
      const { data, error } = await supabase.functions.invoke("validate-session", {
        body: { userId: currentUser.id },
      });

      if (error) {
        console.warn("[Auth] Session validation request failed:", error.message);
        return;
      }

      if (!data.valid) {
        console.log("[Auth] Session invalidated — user no longer exists");
        logout();
        return;
      }

      // Check if nickname or permission changed
      if (data.nickname !== currentUser.nickname || data.permission !== currentUser.permission) {
        console.log("[Auth] Session updated — nickname or permission changed");
        const updatedUser: User = {
          id: currentUser.id,
          nickname: data.nickname,
          permission: data.permission,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));
        setUser(updatedUser);
      } else {
        console.log("[Auth] Session validated");
      }
    } catch (err) {
      console.warn("[Auth] Session validation error:", err);
    }
  }, [logout]);

  // Load user from localStorage on mount and validate
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as User;
        setUser(parsed);
        // Validate on mount
        validateSession(parsed);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setIsLoading(false);
  }, [validateSession]);

  // Periodic validation
  useEffect(() => {
    if (!user) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      validateSession(user);
    }, VALIDATE_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [user, validateSession]);

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
