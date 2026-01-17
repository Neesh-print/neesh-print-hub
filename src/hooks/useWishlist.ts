import { useState, useEffect, useCallback } from "react";

// TODO: Sync with Supabase user_wishlists table when authenticated

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

const saveWishlist = (ids: string[]): void => {
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
}

export const useWishlist = (): UseWishlistReturn => {
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = getStoredWishlist();
    setWishlistIds(stored);
    setIsInitialized(true);
  }, []);

  // Save to localStorage on every change (after initial load)
  useEffect(() => {
    if (isInitialized) {
      saveWishlist(wishlistIds);
    }
  }, [wishlistIds, isInitialized]);

  const isInWishlist = useCallback(
    (id: string): boolean => wishlistIds.includes(id),
    [wishlistIds]
  );

  const addToWishlist = useCallback((id: string): void => {
    setWishlistIds((prev) => {
      if (prev.includes(id)) return prev;
      return [...prev, id];
    });
  }, []);

  const removeFromWishlist = useCallback((id: string): void => {
    setWishlistIds((prev) => prev.filter((i) => i !== id));
  }, []);

  const toggleWishlist = useCallback((id: string): void => {
    setWishlistIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }, []);

  const clearWishlist = useCallback((): void => {
    setWishlistIds([]);
  }, []);

  return {
    wishlistIds,
    isInWishlist,
    addToWishlist,
    removeFromWishlist,
    toggleWishlist,
    clearWishlist,
    wishlistCount: wishlistIds.length,
  };
};
