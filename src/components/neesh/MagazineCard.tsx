import { useState } from "react";
import { Bookmark } from "lucide-react";

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export interface MagazineCardProps {
  coverImage: string;
  title: string;
  publisher: string;
  region?: string;
  price: number;
  retailPrice?: number;
  stockStatus?: StockStatus;
  inventoryCount?: number;
  onClick: () => void;
  onBookmark?: () => void;
  isBookmarked?: boolean;
  showStockIndicator?: boolean;
  showRetailPrice?: boolean;
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
  showRetailPrice = false,
}: MagazineCardProps) => {
  const formattedPrice = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(price);

  const formattedRetailPrice = retailPrice
    ? new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
      }).format(retailPrice)
    : null;

  // Determine stock status from inventory count if not explicitly provided
  const resolvedStockStatus = stockStatus ?? (inventoryCount !== undefined ? getStockStatus(inventoryCount) : undefined);
  const stockConfig = resolvedStockStatus ? stockStatusConfig[resolvedStockStatus] : null;

  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const displayImage = imageError ? "/placeholder.svg" : coverImage;

  return (
    <article className="group cursor-pointer" onClick={onClick}>
      {/* Cover image */}
      <div className="relative aspect-[3/4] mb-3 rounded-lg overflow-hidden bg-secondary shadow-neesh transition-shadow duration-300 group-hover:shadow-neesh-md">
        {/* Loading placeholder */}
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 bg-muted animate-pulse" />
        )}
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
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
        />
        
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
        <h3 className="font-display font-semibold text-body text-foreground line-clamp-1 group-hover:text-accent transition-colors">
          {title}
        </h3>
        
        <p className="text-caption text-muted-foreground line-clamp-1">
          {publisher}
          {region && <span className="ml-1">· {region}</span>}
        </p>
        
        <div className="flex items-baseline gap-2">
          <p className="font-display font-medium text-body text-accent">
            {formattedPrice} <span className="text-caption text-muted-foreground font-normal">WSP</span>
          </p>
          {showRetailPrice && formattedRetailPrice && (
            <p className="text-caption text-muted-foreground line-through">
              {formattedRetailPrice}
            </p>
          )}
        </div>
      </div>
    </article>
  );
};
