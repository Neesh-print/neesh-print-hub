import { createContext, useContext, ReactNode } from "react";
import { useWishlist, UseWishlistReturn } from "@/hooks/useWishlist";

const WishlistContext = createContext<UseWishlistReturn | undefined>(undefined);

export const WishlistProvider = ({ children }: { children: ReactNode }) => {
  const wishlist = useWishlist();

  return (
    <WishlistContext.Provider value={wishlist}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlistContext = (): UseWishlistReturn => {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlistContext must be used within a WishlistProvider");
  }
  return context;
};
