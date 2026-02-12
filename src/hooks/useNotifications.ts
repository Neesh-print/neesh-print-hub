import { useState, useEffect, useCallback } from 'react';

export interface Notification {
  id: string;
  type: 'new_order' | 'order_shipped' | 'order_delivered' | 'order_confirmed' | 'payment' | 'low_inventory' | 'message' | 'new_title' | 'price_drop';
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  link?: string;
  metadata?: Record<string, unknown>;
}

// Notifications will be populated from Supabase real-time subscriptions in the future

const STORAGE_KEY = 'neesh_notifications';

export function useNotifications(userRole: 'publisher' | 'retailer') {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Load notifications from localStorage
  useEffect(() => {
    const storageKey = `${STORAGE_KEY}_${userRole}`;
    const stored = localStorage.getItem(storageKey);

    if (stored) {
      try {
        setNotifications(JSON.parse(stored));
      } catch {
        setNotifications([]);
      }
    }
  }, [userRole]);

  // Save to localStorage whenever notifications change
  useEffect(() => {
    if (notifications.length > 0) {
      const storageKey = `${STORAGE_KEY}_${userRole}`;
      localStorage.setItem(storageKey, JSON.stringify(notifications));
    }
  }, [notifications, userRole]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  // TODO: Replace with Supabase subscription for real-time notifications
  // useEffect(() => {
  //   const subscription = supabase
  //     .channel('notifications')
  //     .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, payload => {
  //       setNotifications(prev => [payload.new as Notification, ...prev]);
  //     })
  //     .subscribe();
  //   return () => { subscription.unsubscribe(); };
  // }, []);

  return { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead 
  };
}
