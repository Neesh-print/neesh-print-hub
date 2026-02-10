import { useState, useMemo } from "react";
import { Bookmark } from "lucide-react";
import { PriceDisplay } from "@/components/ui/price-display";
import { PublicationDate } from "@/components/ui/publication-date";
import { Badge } from "@/components/ui/badge";
import { StockIndicator } from "@/components/ui/stock-indicator";
import { isCurrentMonth } from "@/lib/publication-date";
import { getStockLevel } from "@/lib/inventory";

const SUPABASE_URL = "https://smfzrubkyxejzkblrrjr.supabase.co";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { calculateRetailerPrice } from "@/utils/pricing";
import { ImagePlaceholder } from "@/components/shared/ImagePlaceholder";

export interface MagazineCardProps {
  coverImage: string;
  title: string;
  publisher: string;
  region?: string;
  /** Wholesale price in dollars */
  price: number;
  /** Suggested retail price in dollars */
  retailPrice?: number;
  /** Publication date as ISO string (e.g., "2025-12-01") */
  publicationDate?: string | null;
  inventoryCount?: number;
  onClick: () => void;
  onBookmark?: () => void;
  isBookmarked?: boolean;
  /** Show scarcity indicator on card (default: true) */
  showStockIndicator?: boolean;
  /** Optional custom action handler (replaces bookmark functionality if provided) */
  onAction?: (e: React.MouseEvent) => void;
  /** Icon to use for the custom action (defaults to Bookmark) */
  actionIcon?: React.ElementType;
  /** Label for the custom action */
  actionLabel?: string;
  /** Whether the action button overlay should be forcefully shown on top of other elements */
  showActionOnData?: boolean;
}

// Convert Shopify CDN URLs to use our proxy
const getProxiedUrl = (url: string): string => {
  if (!url) return "/placeholder.svg";
  
  if (url.includes("cdn.shopify.com") || url.includes("shop.neesh.art/cdn/")) {
    return `${SUPABASE_URL}/functions/v1/image-proxy?url=${encodeURIComponent(url)}`;
  }
  
  return url;
};

export const MagazineCard = ({
  coverImage,
  title,
  publisher,
  region,
  price,
  retailPrice,
  publicationDate,
  inventoryCount,
  onClick,
  onBookmark,
  isBookmarked = false,
  showStockIndicator = true,
  onAction,
  actionIcon: ActionIcon,
  actionLabel,
  showActionOnData = false,
}: MagazineCardProps) => {
  const stockLevel = getStockLevel(inventoryCount);
  const isNew = isCurrentMonth(publicationDate);
  const isOutOfStock = stockLevel === 'out';

  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const displayImage = useMemo(() => {
    if (imageError) return "/placeholder.svg";
    return getProxiedUrl(coverImage);
  }, [coverImage, imageError]);

  return (
    <article className="group cursor-pointer" onClick={onClick}>
      {/* Cover image */}
      <div className={`relative aspect-[3/4] mb-3 rounded-lg overflow-hidden bg-secondary shadow-neesh transition-shadow duration-300 group-hover:shadow-neesh-md ${isOutOfStock ? 'opacity-75' : ''}`}>
        {/* Loading placeholder */}
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 bg-muted animate-pulse" />
        )}
        
        {(imageError || !coverImage) ? (
          <div className="absolute inset-0">
            <ImagePlaceholder />
          </div>
        ) : (
          <img
            src={displayImage}
            alt={`${title} cover`}
            className={`w-full h-full object-cover transition-all duration-300 group-hover:scale-105 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={() => setImageLoaded(true)}
            onError={() => {
              setImageError(true);
              setImageLoaded(true);
            }}
          />
        )}
        
        {/* New Badge - top left corner on image (moved from right to avoid colliding with bookmark) */}
        {isNew && (
          <Badge 
            className="absolute top-2 left-2 bg-status-success text-status-success-text text-[10px] px-1.5 z-10"
            aria-label="New release"
          >
            New
          </Badge>
        )}
        
        {/* Stock Indicator - below new badge if both present */}
        {showStockIndicator && stockLevel !== 'normal' && (
          <div className={`absolute ${isNew ? 'top-8' : 'top-2'} left-2`}>
            <StockIndicator quantity={inventoryCount} size="sm" />
          </div>
        )}
        
        {/* Action button (Bookmark or Custom Action) - always top-right, never hidden */}
        {(onBookmark || onAction) && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onAction) onAction(e);
              else if (onBookmark) onBookmark();
            }}
            className={`
              absolute top-2 right-2 p-2 rounded-full
              backdrop-blur-sm transition-all z-20 opacity-100
              bg-background/80 text-foreground hover:bg-background hover:text-accent
              ${isBookmarked ? 'bg-accent text-accent-foreground' : ''}
            `}
            aria-label={actionLabel || (isBookmarked ? 'Remove bookmark' : 'Add bookmark')}
            title={actionLabel}
          >
            {ActionIcon ? (
              <ActionIcon className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
            ) : (
              <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
            )}
          </button>
        )}
      </div>

      {/* Info */}
      <div className="space-y-1">
        <h3 className="font-display font-semibold text-body text-foreground line-clamp-2 group-hover:text-accent transition-colors">
          {title}
        </h3>
        
        <p className="text-caption text-muted-foreground line-clamp-1">
          {publisher}
          {region && <span className="ml-1">· {region}</span>}
        </p>
        
        {/* Publication Date */}
        {publicationDate && (
          <PublicationDate 
            date={publicationDate} 
            format="short" 
            size="sm"
          />
        )}
        
        <PriceDisplay
          wholesalePrice={calculateRetailerPrice(price)}
          retailPrice={retailPrice}
          layout="inline"
          size="sm"
          showMargin={false}
          showTotal={false}
        />
      </div>
    </article>
  );
};
