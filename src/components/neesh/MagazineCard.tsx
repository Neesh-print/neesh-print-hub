import { useState, useMemo } from "react";
import { Bookmark } from "lucide-react";
import { PriceDisplay } from "@/components/ui/price-display";

const SUPABASE_URL = "https://smfzrubkyxejzkblrrjr.supabase.co";

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

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
  stockStatus?: StockStatus;
  inventoryCount?: number;
  onClick: () => void;
  onBookmark?: () => void;
  isBookmarked?: boolean;
  showStockIndicator?: boolean;
}

const getStockStatus = (inventoryCount: number): StockStatus => {
  if (inventoryCount <= 0) return 'out_of_stock';
  if (inventoryCount <= 10) return 'low_stock';
  return 'in_stock';
};

const stockStatusConfig: Record<StockStatus, { color: string; label: string }> = {
  in_stock: { color: 'bg-status-success', label: 'In Stock' },
  low_stock: { color: 'bg-status-warning', label: 'Low Stock' },
  out_of_stock: { color: 'bg-status-error', label: 'Out of Stock' },
};

// Convert Shopify CDN URLs to use our proxy
const getProxiedUrl = (url: string): string => {
  if (!url) return "/placeholder.svg";
  
  if (url.includes("cdn.shopify.com")) {
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
  stockStatus,
  inventoryCount,
  onClick,
  onBookmark,
  isBookmarked = false,
  showStockIndicator = false,
}: MagazineCardProps) => {
  // Determine stock status from inventory count if not explicitly provided
  const resolvedStockStatus = stockStatus ?? (inventoryCount !== undefined ? getStockStatus(inventoryCount) : undefined);
  const stockConfig = resolvedStockStatus ? stockStatusConfig[resolvedStockStatus] : null;

  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const displayImage = useMemo(() => {
    if (imageError) return "/placeholder.svg";
    return getProxiedUrl(coverImage);
  }, [coverImage, imageError]);

  return (
    <article className="group cursor-pointer" onClick={onClick}>
      {/* Cover image */}
      <div className="relative aspect-[3/4] mb-3 rounded-lg overflow-hidden bg-secondary shadow-neesh transition-shadow duration-300 group-hover:shadow-neesh-md">
        {/* Image / Placeholder */}
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 bg-muted animate-pulse" />
        )}
        
        {imageError ? (
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
        
        {/* Stock Indicator */}
        {showStockIndicator && stockConfig && (
          <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-background/90 backdrop-blur-sm px-2 py-1 rounded-full">
            <span className={`w-2 h-2 rounded-full ${stockConfig.color}`} />
            <span className="text-[10px] font-medium text-foreground">{stockConfig.label}</span>
          </div>
        )}
        
        {/* Bookmark button */}
        {onBookmark && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onBookmark();
            }}
            className={`
              absolute top-2 right-2 p-2 rounded-full
              backdrop-blur-sm transition-all
              ${isBookmarked 
                ? 'bg-accent text-accent-foreground' 
                : 'bg-background/80 text-foreground hover:bg-background'
              }
            `}
            aria-label={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
          >
            <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
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
