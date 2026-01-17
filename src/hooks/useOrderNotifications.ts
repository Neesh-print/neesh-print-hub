import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface OrderNotification {
  id: string;
  orderId: string;
  title: string;
  message: string;
  quantity: number;
  totalPrice: number;
  retailerName: string | null;
  magazineTitle: string;
  createdAt: string;
  isRead: boolean;
}

export interface UseOrderNotificationsReturn {
  notifications: OrderNotification[];
  unreadCount: number;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
}

export const useOrderNotifications = (): UseOrderNotificationsReturn => {
  const [notifications, setNotifications] = useState<OrderNotification[]>([]);
  const { user } = useAuth();

  // Get publisher ID for the current user
  const [publisherId, setPublisherId] = useState<string | null>(null);

  useEffect(() => {
    const fetchPublisherId = async () => {
      if (!user?.id) return;

      const { data } = await supabase
        .from('publishers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (data) {
        setPublisherId(data.id);
      }
    };

    fetchPublisherId();
  }, [user?.id]);

  // Subscribe to new orders for this publisher's magazines
  useEffect(() => {
    if (!publisherId) return;

    // Subscribe to orders table for INSERT events
    const channel = supabase
      .channel('publisher-orders')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
        },
        async (payload) => {
          const newOrder = payload.new as {
            id: string;
            magazine_id: string;
            retailer_id: string;
            quantity: number;
            total_price: number;
            created_at: string;
          };

          // Fetch magazine details to check if it belongs to this publisher
          const { data: magazine } = await supabase
            .from('magazines')
            .select('id, title, publisher_id')
            .eq('id', newOrder.magazine_id)
            .single();

          if (!magazine || magazine.publisher_id !== publisherId) {
            return; // Not our magazine
          }

          // Fetch retailer info
          const { data: retailer } = await supabase
            .from('retailers')
            .select('shop_name')
            .eq('user_id', newOrder.retailer_id)
            .single();

          const notification: OrderNotification = {
            id: `order-${newOrder.id}-${Date.now()}`,
            orderId: newOrder.id,
            title: 'New Order Received',
            message: `${retailer?.shop_name || 'A retailer'} ordered ${newOrder.quantity}x ${magazine.title}`,
            quantity: newOrder.quantity,
            totalPrice: newOrder.total_price,
            retailerName: retailer?.shop_name || null,
            magazineTitle: magazine.title,
            createdAt: newOrder.created_at,
            isRead: false,
          };

          // Add notification to state
          setNotifications(prev => [notification, ...prev]);

          // Show toast notification
          toast.success('New Order!', {
            description: notification.message,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [publisherId]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev =>
      prev.map(n =>
        n.id === notificationId ? { ...n, isRead: true } : n
      )
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotifications,
  };
};
