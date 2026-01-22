import { Bookmark } from "lucide-react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { calculateRetailerPrice } from "@/utils/pricing";

export interface MagazineCardProps {
  coverImage: string;
  title: string;
  publisher: string;
  region?: string;
  price: number;
  onClick: () => void;
  onBookmark?: () => void;
  isBookmarked?: boolean;
}

export const MagazineCard = ({
  coverImage,
  title,
  publisher,
  region,
  price,
  onClick,
  onBookmark,
  isBookmarked = false,
}: MagazineCardProps) => {
  const formattedPrice = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(calculateRetailerPrice(price));

  return (
    <article className="group cursor-pointer" onClick={onClick}>
      {/* Cover image */}
      <div className="relative aspect-[3/4] mb-3 rounded-lg overflow-hidden bg-secondary">
        <img
          src={coverImage}
          alt={`${title} cover`}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        
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
        

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="font-display font-medium text-body text-accent w-fit cursor-help">
                {formattedPrice} <span className="text-caption text-muted-foreground font-normal">WSP</span>
              </p>
            </TooltipTrigger>
            <TooltipContent>
              <p>Includes platform fee</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </article>
  );
};
