import { useState, useEffect, useMemo } from 'react';
import { User, BookOpen, CreditCard, Share, Store, MapPin, Search, Bookmark, ShoppingBag, LucideIcon } from 'lucide-react';

export interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  action: {
    label: string;
    href: string;
  };
  icon: LucideIcon;
}

interface OnboardingState {
  items: ChecklistItem[];
  completedCount: number;
  totalCount: number;
  allComplete: boolean;
  dismissed: boolean;
  markDismissed: () => void;
  markItemViewed: (itemId: string) => void;
}

// Storage keys
const STORAGE_PREFIX = 'neesh_onboarding';

const getStorageKey = (role: string, key: string) => `${STORAGE_PREFIX}_${role}_${key}`;

export function useOnboardingProgress(
  userRole: 'publisher' | 'retailer',
  contextData?: {
    hasProfile?: boolean;
    hasProfileBio?: boolean;
    hasProfileWebsite?: boolean;
    hasProfileInstagram?: boolean;
    hasShippingAddress?: boolean;
    titleCount?: number;
    orderCount?: number;
    wishlistCount?: number;
    publisherName?: string;
    storeName?: string;
  }
): OnboardingState {
  const [dismissed, setDismissed] = useState(false);
  const [viewedItems, setViewedItems] = useState<Set<string>>(new Set());

  // Load dismissed state and viewed items from localStorage
  useEffect(() => {
    const dismissedStored = localStorage.getItem(getStorageKey(userRole, 'dismissed'));
    if (dismissedStored === 'true') {
      setDismissed(true);
    }

    const viewedStored = localStorage.getItem(getStorageKey(userRole, 'viewed_items'));
    if (viewedStored) {
      try {
        const parsed = JSON.parse(viewedStored);
        setViewedItems(new Set(parsed));
      } catch (e) {
        // Ignore parse errors
      }
    }

    // Track catalog views for retailers
    if (userRole === 'retailer') {
      const catalogViews = parseInt(localStorage.getItem(getStorageKey(userRole, 'catalog_views')) || '0');
      localStorage.setItem(getStorageKey(userRole, 'catalog_views'), String(catalogViews + 1));
    }
  }, [userRole]);

  const markDismissed = () => {
    localStorage.setItem(getStorageKey(userRole, 'dismissed'), 'true');
    setDismissed(true);
  };

  const markItemViewed = (itemId: string) => {
    const newViewed = new Set(viewedItems);
    newViewed.add(itemId);
    setViewedItems(newViewed);
    localStorage.setItem(getStorageKey(userRole, 'viewed_items'), JSON.stringify([...newViewed]));
  };

  const items = useMemo(() => {
    if (userRole === 'publisher') {
      return getPublisherChecklist(contextData, viewedItems);
    } else {
      return getRetailerChecklist(contextData, viewedItems);
    }
  }, [userRole, contextData, viewedItems]);

  const completedCount = items.filter(i => i.completed).length;
  const totalCount = items.length;
  const allComplete = items.every(i => i.completed);

  return {
    items,
    completedCount,
    totalCount,
    allComplete,
    dismissed,
    markDismissed,
    markItemViewed,
  };
}

function getPublisherChecklist(
  contextData?: {
    hasProfileBio?: boolean;
    hasProfileWebsite?: boolean;
    hasProfileInstagram?: boolean;
    titleCount?: number;
  },
  viewedItems?: Set<string>
): ChecklistItem[] {
  const hasProfile = contextData?.hasProfileBio && 
    (contextData?.hasProfileWebsite || contextData?.hasProfileInstagram);
  const hasTitle = (contextData?.titleCount ?? 0) > 0;
  const hasSharedProfile = viewedItems?.has('share_profile') ?? false;
  
  // Payout setup - check localStorage for now
  const hasPayoutSetup = localStorage.getItem(getStorageKey('publisher', 'payout_setup')) === 'true';

  return [
    {
      id: 'complete_profile',
      title: 'Complete your profile',
      description: 'Add a bio and website to help retailers find you',
      completed: hasProfile ?? false,
      action: {
        label: 'Complete Profile',
        href: '/publisher/profile',
      },
      icon: User,
    },
    {
      id: 'add_first_title',
      title: 'Add your first title',
      description: 'List a magazine so retailers can order',
      completed: hasTitle,
      action: {
        label: 'Add Title',
        href: '/publisher/titles/new',
      },
      icon: BookOpen,
    },
    {
      id: 'setup_payouts',
      title: 'Set up payouts',
      description: 'Add your bank details to receive payments',
      completed: hasPayoutSetup,
      action: {
        label: 'Set Up Payouts',
        href: '/publisher/settings#payouts',
      },
      icon: CreditCard,
    },
    {
      id: 'share_profile',
      title: 'Share your profile',
      description: "Let your audience know you're on Neesh",
      completed: hasSharedProfile,
      action: {
        label: 'Get Your Link',
        href: '/publisher/profile#share',
      },
      icon: Share,
    },
  ];
}

function getRetailerChecklist(
  contextData?: {
    hasProfile?: boolean;
    hasProfileDescription?: boolean;
    hasProfileWebsite?: boolean;
    hasProfileInstagram?: boolean;
    hasStoreTypes?: boolean;
    hasShippingAddress?: boolean;
    orderCount?: number;
    wishlistCount?: number;
    profileCompletedAt?: string | null;
  },
  viewedItems?: Set<string>
): ChecklistItem[] {
  // Profile is complete if profile_completed_at is set OR has description + store types
  const hasProfileComplete = contextData?.profileCompletedAt || 
    (contextData?.hasProfileDescription && contextData?.hasStoreTypes);
  const hasShippingAddress = contextData?.hasShippingAddress ?? false;
  const hasOrder = (contextData?.orderCount ?? 0) > 0;
  const hasWishlistItem = (contextData?.wishlistCount ?? 0) > 0;
  
  // Track catalog browsing
  const catalogViews = parseInt(localStorage.getItem(getStorageKey('retailer', 'catalog_views')) || '0');
  const hasBrowsedCatalog = catalogViews >= 5;

  return [
    {
      id: 'complete_profile',
      title: 'Complete your store profile',
      description: 'Tell publishers about your store',
      completed: !!hasProfileComplete,
      action: {
        label: 'Complete Profile',
        href: '/retailer/profile/edit',
      },
      icon: Store,
    },
    {
      id: 'add_shipping',
      title: 'Add your shipping address',
      description: 'Add your shipping address for faster checkout',
      completed: hasShippingAddress,
      action: {
        label: 'Add Address',
        href: '/retailer/profile/edit',
      },
      icon: MapPin,
    },
    {
      id: 'browse_catalog',
      title: 'Browse the catalog',
      description: 'Discover titles that fit your store',
      completed: hasBrowsedCatalog,
      action: {
        label: 'Browse Catalog',
        href: '/retailer',
      },
      icon: Search,
    },
    {
      id: 'save_to_wishlist',
      title: 'Save titles to your wishlist',
      description: 'Bookmark titles you want to order later',
      completed: hasWishlistItem,
      action: {
        label: 'Browse & Save',
        href: '/retailer',
      },
      icon: Bookmark,
    },
    {
      id: 'place_first_order',
      title: 'Place your first order',
      description: 'Start with a small trial order',
      completed: hasOrder,
      action: {
        label: 'View Cart',
        href: '/retailer/cart',
      },
      icon: ShoppingBag,
    },
  ];
}

export default useOnboardingProgress;
