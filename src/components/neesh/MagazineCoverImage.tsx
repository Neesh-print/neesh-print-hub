import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

const SUPABASE_URL = "https://smfzrubkyxejzkblrrjr.supabase.co";

interface MagazineCoverImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  priority?: boolean;
}

// Rewrite broken shop.neesh.art URLs to cdn.shopify.com
const rewriteShopifyUrl = (url: string): string => {
  if (url.includes("shop.neesh.art")) {
    return url.replace("shop.neesh.art", "cdn.shopify.com");
  }
  return url;
};

// Convert Shopify CDN URLs to use our proxy
const getProxiedUrl = (url: string | null | undefined): string => {
  if (!url) return "/placeholder.svg";

  const rewritten = rewriteShopifyUrl(url);

  // Check if it's a Shopify CDN URL that needs proxying
  if (rewritten.includes("cdn.shopify.com")) {
    return `${SUPABASE_URL}/functions/v1/image-proxy?url=${encodeURIComponent(rewritten)}`;
  }

  return rewritten;
};

export const MagazineCoverImage = ({
  src,
  alt,
  className,
  priority = false,
}: MagazineCoverImageProps) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const displayImage = useMemo(() => {
    if (imageError) return "/placeholder.svg";
    return getProxiedUrl(src);
  }, [src, imageError]);

  return (
    <>
      {/* Loading placeholder */}
      {!imageLoaded && !imageError && (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}
      <img
        src={displayImage}
        alt={alt}
        className={cn(
          "w-full h-full object-cover transition-opacity duration-300",
          imageLoaded ? "opacity-100" : "opacity-0",
          className
        )}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "sync" : "async"}
        onLoad={() => setImageLoaded(true)}
        onError={() => {
          setImageError(true);
          setImageLoaded(true);
        }}
      />
    </>
  );
};
