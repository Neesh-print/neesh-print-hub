import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const STORAGE_KEY = "neesh_wishlist";

const getStoredWishlist = (): string[] => {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveWishlistToStorage = (ids: string[]): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    console.error("Failed to save wishlist to localStorage");
  }
};

export interface UseWishlistReturn {
  wishlistIds: string[];
  isInWishlist: (id: string) => boolean;
  addToWishlist: (id: string) => void;
  removeFromWishlist: (id: string) => void;
  toggleWishlist: (id: string) => void;
  clearWishlist: () => void;
  wishlistCount: number;
  isLoading: boolean;
}

export const useWishlist = (): UseWishlistReturn => {
  const { user } = useAuth();
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load wishlist from Supabase if authenticated, otherwise from localStorage
  useEffect(() => {
    const loadWishlist = async () => {
      setIsLoading(true);
      
      if (user) {
        // Fetch from Supabase
        const { data, error } = await supabase
          .from("user_wishlists")
          .select("product_id")
          .eq("user_id", user.id);
        
        if (error) {
          console.error("Failed to load wishlist from Supabase:", error);
          // Fall back to localStorage
          setWishlistIds(getStoredWishlist());
        } else {
          const ids = data?.map((item) => item.product_id) || [];
          setWishlistIds(ids);
          // Also update localStorage for offline access
          saveWishlistToStorage(ids);
        }
      } else {
        // Not authenticated, use localStorage
        setWishlistIds(getStoredWishlist());
      }
      
      setIsLoading(false);
      setIsInitialized(true);
    };

    loadWishlist();
  }, [user]);

  // Sync localStorage when wishlist changes (after initialization)
  useEffect(() => {
    if (isInitialized) {
      saveWishlistToStorage(wishlistIds);
    }
  }, [wishlistIds, isInitialized]);

  // Merge localStorage wishlist with Supabase when user logs in
  useEffect(() => {
    const mergeWishlistOnLogin = async () => {
      if (!user || !isInitialized) return;
      
      const localWishlist = getStoredWishlist();
      if (localWishlist.length === 0) return;

      // Get existing Supabase wishlist
      const { data: existingItems } = await supabase
        .from("user_wishlists")
        .select("product_id")
        .eq("user_id", user.id);
      
      const existingIds = new Set(existingItems?.map((item) => item.product_id) || []);
      
      // Find items to add (in localStorage but not in Supabase)
      const itemsToAdd = localWishlist.filter((id) => !existingIds.has(id));
      
      if (itemsToAdd.length > 0) {
        const { error } = await supabase
          .from("user_wishlists")
          .insert(itemsToAdd.map((product_id) => ({ user_id: user.id, product_id })));
        
        if (error) {
          console.error("Failed to merge wishlist:", error);
        } else {
          // Refresh wishlist from Supabase
          const { data } = await supabase
            .from("user_wishlists")
            .select("product_id")
            .eq("user_id", user.id);
          
          const mergedIds = data?.map((item) => item.product_id) || [];
          setWishlistIds(mergedIds);
        }
      }
    };

    mergeWishlistOnLogin();
  }, [user, isInitialized]);

  const isInWishlist = useCallback(
    (id: string): boolean => wishlistIds.includes(id),
    [wishlistIds]
  );

  const addToWishlist = useCallback(
    async (id: string): Promise<void> => {
      if (wishlistIds.includes(id)) return;

      // Optimistic update
      setWishlistIds((prev) => [...prev, id]);

      if (user) {
        const { error } = await supabase
          .from("user_wishlists")
          .insert({ user_id: user.id, product_id: id });
        
        if (error) {
          console.error("Failed to add to wishlist:", error);
          // Rollback on error
          setWishlistIds((prev) => prev.filter((i) => i !== id));
        }
      }
    },
    [user, wishlistIds]
  );

  const removeFromWishlist = useCallback(
    async (id: string): Promise<void> => {
      // Optimistic update
      setWishlistIds((prev) => prev.filter((i) => i !== id));

      if (user) {
        const { error } = await supabase
          .from("user_wishlists")
          .delete()
          .eq("user_id", user.id)
          .eq("product_id", id);
        
        if (error) {
          console.error("Failed to remove from wishlist:", error);
          // Rollback on error
          setWishlistIds((prev) => [...prev, id]);
        }
      }
    },
    [user]
  );

  const toggleWishlist = useCallback(
    (id: string): void => {
      if (wishlistIds.includes(id)) {
        removeFromWishlist(id);
      } else {
        addToWishlist(id);
      }
    },
    [wishlistIds, addToWishlist, removeFromWishlist]
  );

  const clearWishlist = useCallback(async (): Promise<void> => {
    const previousIds = [...wishlistIds];
    
    // Optimistic update
    setWishlistIds([]);

    if (user) {
      const { error } = await supabase
        .from("user_wishlists")
        .delete()
        .eq("user_id", user.id);
      
      if (error) {
        console.error("Failed to clear wishlist:", error);
        // Rollback on error
        setWishlistIds(previousIds);
      }
    }
  }, [user, wishlistIds]);

  return {
    wishlistIds,
    isInWishlist,
    addToWishlist,
    removeFromWishlist,
    toggleWishlist,
    clearWishlist,
    wishlistCount: wishlistIds.length,
    isLoading,
  };
};
