import { useState } from "react";
import { cn } from "@/lib/utils";

interface MagazineCoverImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  priority?: boolean;
}

export const MagazineCoverImage = ({
  src,
  alt,
  className,
  priority = false,
}: MagazineCoverImageProps) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const displayImage = !src || imageError ? "/placeholder.svg" : src;

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
        referrerPolicy="no-referrer"
      />
    </>
  );
};
