import { createContext, useContext, useState, ReactNode } from "react";

export interface CartItem {
  magazineId: string;
  title: string;
  coverImage: string;
  publisher: string;
  issue?: string;
  quantity: number;
  price: number;
}

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
  removeFromCart: (magazineId: string) => void;
  updateQuantity: (magazineId: string, quantity: number) => void;
  clearCart: () => void;
  cartTotal: number;
  cartItemCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  const addToCart = (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => {
    setCartItems(prev => {
      const existing = prev.find(i => i.magazineId === item.magazineId);
      if (existing) {
        return prev.map(i => 
          i.magazineId === item.magazineId 
            ? { ...i, quantity: i.quantity + (item.quantity || 1) }
            : i
        );
      }
      return [...prev, { ...item, quantity: item.quantity || 1 }];
    });
  };

  const removeFromCart = (magazineId: string) => {
    setCartItems(prev => prev.filter(i => i.magazineId !== magazineId));
  };

  const updateQuantity = (magazineId: string, quantity: number) => {
    if (quantity < 1) {
      removeFromCart(magazineId);
      return;
    }
    setCartItems(prev => 
      prev.map(i => i.magazineId === magazineId ? { ...i, quantity } : i)
    );
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const cartTotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider value={{
      cartItems,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      cartTotal,
      cartItemCount,
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};
