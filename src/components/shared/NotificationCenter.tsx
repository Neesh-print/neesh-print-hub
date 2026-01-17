import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, 
  BellOff,
  ShoppingBag, 
  Truck, 
  DollarSign, 
  AlertTriangle, 
  MessageSquare,
  CheckCircle,
  Package,
  Sparkles,
  Tag
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications, Notification } from '@/hooks/useNotifications';
import { useIsMobile } from '@/hooks/use-mobile';

interface NotificationCenterProps {
  userRole: 'publisher' | 'retailer';
}

const getNotificationIcon = (type: Notification['type']) => {
  switch (type) {
    case 'new_order':
      return <ShoppingBag className="w-5 h-5 text-foreground" />;
    case 'order_shipped':
      return <Truck className="w-5 h-5 text-blue-600" />;
    case 'order_delivered':
      return <Package className="w-5 h-5 text-green-600" />;
    case 'order_confirmed':
      return <CheckCircle className="w-5 h-5 text-green-600" />;
    case 'payment':
      return <DollarSign className="w-5 h-5 text-green-600" />;
    case 'low_inventory':
      return <AlertTriangle className="w-5 h-5 text-amber-500" />;
    case 'message':
      return <MessageSquare className="w-5 h-5 text-accent" />;
    case 'new_title':
      return <Sparkles className="w-5 h-5 text-accent" />;
    case 'price_drop':
      return <Tag className="w-5 h-5 text-green-600" />;
    default:
      return <Bell className="w-5 h-5 text-muted-foreground" />;
  }
};

const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

interface NotificationItemProps {
  notification: Notification;
  onRead: (id: string) => void;
  onNavigate: (link?: string) => void;
}

const NotificationItem = ({ notification, onRead, onNavigate }: NotificationItemProps) => {
  const handleClick = () => {
    onRead(notification.id);
    if (notification.link) {
      onNavigate(notification.link);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`
        w-full flex items-start gap-3 p-4 text-left transition-colors
        hover:bg-secondary/50
        ${!notification.read ? 'bg-accent/5' : ''}
      `}
    >
      {/* Unread indicator */}
      <div className="relative flex-shrink-0">
        {!notification.read && (
          <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-accent" />
        )}
        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
          {getNotificationIcon(notification.type)}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate ${!notification.read ? 'font-semibold' : 'font-medium'} text-foreground`}>
          {notification.title}
        </p>
        <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
          {notification.description}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {formatTimestamp(notification.timestamp)}
        </p>
      </div>
    </button>
  );
};

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center py-12 px-4">
    <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mb-4">
      <BellOff className="w-6 h-6 text-muted-foreground" />
    </div>
    <p className="font-medium text-foreground mb-1">No notifications yet</p>
    <p className="text-sm text-muted-foreground text-center">
      We'll let you know when something happens
    </p>
  </div>
);

interface NotificationListProps {
  notifications: Notification[];
  unreadCount: number;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onNavigate: (link?: string) => void;
}

const NotificationList = ({ 
  notifications, 
  unreadCount, 
  onMarkAsRead, 
  onMarkAllAsRead,
  onNavigate 
}: NotificationListProps) => (
  <div className="flex flex-col h-full">
    {/* Header */}
    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
      <h3 className="font-semibold text-foreground">Notifications</h3>
      {unreadCount > 0 && (
        <button
          onClick={onMarkAllAsRead}
          className="text-sm text-accent hover:text-accent/80 transition-colors"
        >
          Mark all as read
        </button>
      )}
    </div>

    {/* Notifications */}
    {notifications.length === 0 ? (
      <EmptyState />
    ) : (
      <ScrollArea className="flex-1">
        <div className="divide-y divide-border">
          {notifications.map(notification => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onRead={onMarkAsRead}
              onNavigate={onNavigate}
            />
          ))}
        </div>
        {/* TODO: "View all" link to full notifications page */}
      </ScrollArea>
    )}
  </div>
);

export const NotificationCenter = ({ userRole }: NotificationCenterProps) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications(userRole);

  const handleNavigate = (link?: string) => {
    setOpen(false);
    if (link) {
      navigate(link);
    }
  };

  const TriggerButton = (
    <button
      className="relative p-2 rounded-lg hover:bg-secondary transition-colors"
      aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
    >
      <Bell className="w-5 h-5 text-foreground" />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-destructive text-destructive-foreground text-[10px] font-medium rounded-full px-1">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );

  // Mobile: Use drawer (sheet from bottom)
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          {TriggerButton}
        </DrawerTrigger>
        <DrawerContent className="h-[85vh]">
          <DrawerHeader className="sr-only">
            <DrawerTitle>Notifications</DrawerTitle>
          </DrawerHeader>
          <NotificationList
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkAsRead={markAsRead}
            onMarkAllAsRead={markAllAsRead}
            onNavigate={handleNavigate}
          />
        </DrawerContent>
      </Drawer>
    );
  }

  // Desktop: Use popover
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {TriggerButton}
      </PopoverTrigger>
      <PopoverContent 
        className="w-[380px] p-0 max-h-[500px] overflow-hidden" 
        align="end"
        sideOffset={8}
      >
        <NotificationList
          notifications={notifications}
          unreadCount={unreadCount}
          onMarkAsRead={markAsRead}
          onMarkAllAsRead={markAllAsRead}
          onNavigate={handleNavigate}
        />
      </PopoverContent>
    </Popover>
  );
};

// TODO: Real-time notifications via Supabase subscriptions
// TODO: Notification preferences (which types to receive)
// TODO: Push notifications for mobile
// TODO: Delete/dismiss individual notifications
