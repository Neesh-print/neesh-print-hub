import { Instagram, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { getInstagramUrl, formatInstagramHandle, getDisplayDomain, normalizeWebsiteUrl } from "@/lib/social-links";

interface SocialLinksProps {
  instagramHandle: string | null;
  websiteUrl: string | null;
  layout?: 'inline' | 'stacked';
  showLabels?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function SocialLinks({
  instagramHandle,
  websiteUrl,
  layout = 'inline',
  showLabels = false,
  size = 'md',
  className,
}: SocialLinksProps) {
  const instagramUrl = getInstagramUrl(instagramHandle);
  const displayHandle = formatInstagramHandle(instagramHandle);
  const displayDomain = getDisplayDomain(websiteUrl);

  // If both are null, render nothing
  if (!instagramUrl && !websiteUrl) return null;

  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const textSize = size === 'sm' ? 'text-sm' : 'text-base';
  const gap = size === 'sm' ? 'gap-1' : 'gap-1.5';
  const containerGap = layout === 'inline' ? 'gap-4' : 'gap-2';

  const linkClasses = cn(
    "inline-flex items-center text-muted-foreground hover:text-foreground transition-colors",
    gap,
    textSize
  );

  return (
    <div
      className={cn(
        "flex",
        layout === 'inline' ? 'flex-row flex-wrap' : 'flex-col',
        containerGap,
        className
      )}
    >
      {instagramUrl && (
        <a
          href={instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClasses}
          aria-label="Visit publisher Instagram"
        >
          <Instagram className={iconSize} aria-hidden="true" />
          {(showLabels || displayHandle) && (
            <span>{showLabels ? `Instagram ${displayHandle || ''}` : displayHandle}</span>
          )}
        </a>
      )}
      {websiteUrl && (
        <a
          href={normalizeWebsiteUrl(websiteUrl) || "#"}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClasses}
          aria-label="Visit publisher website"
        >
          <Globe className={iconSize} aria-hidden="true" />
          {(showLabels || displayDomain) && (
            <span>{showLabels ? `Website: ${displayDomain || ''}` : displayDomain}</span>
          )}
        </a>
      )}
    </div>
  );
}
