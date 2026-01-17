import { useState, useEffect, useCallback } from 'react';

export interface Notification {
  id: string;
  type: 'new_order' | 'order_shipped' | 'order_delivered' | 'order_confirmed' | 'payment' | 'low_inventory' | 'message' | 'new_title' | 'price_drop';
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  link?: string;
  metadata?: Record<string, any>;
}

const MOCK_PUBLISHER_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    type: 'new_order',
    title: 'New order from McNally Jackson',
    description: 'Wax Poetics Issue 75 × 3',
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    read: false,
    link: '/publisher/orders',
  },
  {
    id: '2',
    type: 'payment',
    title: 'Payment processed',
    description: '$156.00 deposited to your account',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    read: false,
    link: '/publisher/transactions',
  },
  {
    id: '3',
    type: 'low_inventory',
    title: 'Low inventory alert',
    description: 'Issue 75 has only 5 copies remaining',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    read: true,
    link: '/publisher/titles',
  },
  {
    id: '4',
    type: 'order_shipped',
    title: 'Order marked as shipped',
    description: 'Tracking sent to The Corner Bookshop',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    read: true,
    link: '/publisher/orders',
  },
];

const MOCK_RETAILER_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    type: 'order_shipped',
    title: 'Order #ORD-789 has shipped',
    description: 'Tracking: 1Z999AA10123456784',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    read: false,
    link: '/retailer/orders',
  },
  {
    id: '2',
    type: 'new_title',
    title: 'New from Broccoli Publishing',
    description: 'Mushroom People Volume 3 now available',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    read: false,
    link: '/retailer',
  },
  {
    id: '3',
    type: 'order_delivered',
    title: 'Order #ORD-456 delivered',
    description: 'Your magazines have arrived',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    read: true,
    link: '/retailer/orders',
  },
  {
    id: '4',
    type: 'order_confirmed',
    title: 'Order #ORD-123 confirmed',
    description: 'Indie Press Co received your order',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    read: true,
    link: '/retailer/orders',
  },
];

const STORAGE_KEY = 'neesh_notifications';

export function useNotifications(userRole: 'publisher' | 'retailer') {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Load notifications from localStorage or use mock data
  useEffect(() => {
    const storageKey = `${STORAGE_KEY}_${userRole}`;
    const stored = localStorage.getItem(storageKey);
    
    if (stored) {
      try {
        setNotifications(JSON.parse(stored));
      } catch {
        // If parsing fails, use mock data
        const mockData = userRole === 'publisher' ? MOCK_PUBLISHER_NOTIFICATIONS : MOCK_RETAILER_NOTIFICATIONS;
        setNotifications(mockData);
        localStorage.setItem(storageKey, JSON.stringify(mockData));
      }
    } else {
      // First time - use mock data
      const mockData = userRole === 'publisher' ? MOCK_PUBLISHER_NOTIFICATIONS : MOCK_RETAILER_NOTIFICATIONS;
      setNotifications(mockData);
      localStorage.setItem(storageKey, JSON.stringify(mockData));
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
