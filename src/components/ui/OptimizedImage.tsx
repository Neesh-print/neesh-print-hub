import { useState, useEffect, ImgHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface OptimizedImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  fallbackSrc?: string;
  aspectRatio?: "square" | "video" | "portrait" | "auto";
  priority?: boolean;
  blur?: boolean;
}

export function OptimizedImage({
  src,
  alt,
  fallbackSrc = "/placeholder.svg",
  aspectRatio = "auto",
  priority = false,
  blur = true,
  className,
  ...props
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);

  useEffect(() => {
    setIsLoaded(false);
    setIsError(false);
    setCurrentSrc(src);
  }, [src]);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    setIsError(true);
    if (fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
    }
  };

  const aspectRatioClasses = {
    square: "aspect-square",
    video: "aspect-video",
    portrait: "aspect-[3/4]",
    auto: "",
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-muted",
        aspectRatioClasses[aspectRatio],
        className
      )}
    >
      {/* Blur placeholder backdrop */}
      {blur && !isLoaded && !isError && (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}

      <img
        src={currentSrc}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "sync" : "async"}
        onLoad={handleLoad}
        onError={handleError}
        className={cn(
          "w-full h-full object-cover transition-all duration-300",
          blur && !isLoaded && "scale-105 blur-sm",
          isLoaded && "scale-100 blur-0",
          isError && "opacity-50"
        )}
        {...props}
      />
    </div>
  );
}

// Responsive image with srcset support
interface ResponsiveImageProps extends Omit<OptimizedImageProps, 'srcSet'> {
  srcSetItems?: {
    src: string;
    width: number;
  }[];
  sizes?: string;
}

export function ResponsiveImage({
  src,
  srcSetItems,
  sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
  ...props
}: ResponsiveImageProps) {
  const srcSetString = srcSetItems
    ?.map(({ src, width }) => `${src} ${width}w`)
    .join(", ");

  return (
    <OptimizedImage
      src={src}
      srcSet={srcSetString}
      sizes={sizes}
      {...props}
    />
  );
}

// Avatar-specific optimized image
interface OptimizedAvatarProps {
  src?: string | null;
  alt: string;
  fallback?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function OptimizedAvatar({
  src,
  alt,
  fallback,
  size = "md",
  className,
}: OptimizedAvatarProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);

  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-16 h-16",
    xl: "w-24 h-24",
  };

  const textSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-xl",
    xl: "text-2xl",
  };

  const initials = fallback || alt.charAt(0).toUpperCase();

  if (!src || isError) {
    return (
      <div
        className={cn(
          "rounded-full bg-secondary flex items-center justify-center font-medium text-muted-foreground",
          sizeClasses[size],
          textSizeClasses[size],
          className
        )}
      >
        {initials}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative rounded-full overflow-hidden bg-muted",
        sizeClasses[size],
        className
      )}
    >
      {!isLoaded && (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setIsLoaded(true)}
        onError={() => setIsError(true)}
        className={cn(
          "w-full h-full object-cover transition-opacity duration-300",
          isLoaded ? "opacity-100" : "opacity-0"
        )}
      />
    </div>
  );
}

// Magazine cover optimized for catalogue
interface MagazineCoverProps {
  src?: string | null;
  alt: string;
  priority?: boolean;
  className?: string;
}

export function MagazineCover({
  src,
  alt,
  priority = false,
  className,
}: MagazineCoverProps) {
  return (
    <OptimizedImage
      src={src || "/placeholder.svg"}
      alt={alt}
      aspectRatio="portrait"
      priority={priority}
      fallbackSrc="/placeholder.svg"
      className={cn("rounded-lg", className)}
    />
  );
}
