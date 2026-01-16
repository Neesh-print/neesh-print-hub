import { X } from "lucide-react";

export interface ImagePreviewProps {
  src: string;
  alt: string;
  onRemove?: () => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-16 h-16',
  md: 'w-[120px] h-[120px]',
  lg: 'w-[200px] h-[200px]',
};

export const ImagePreview = ({
  src,
  alt,
  onRemove,
  size = 'md',
  className = '',
}: ImagePreviewProps) => {
  return (
    <div className={`relative group rounded-lg overflow-hidden ${sizeClasses[size]} ${className}`}>
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover transition-opacity group-hover:opacity-75"
      />
      
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-1 right-1 p-1 bg-foreground/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-foreground"
          aria-label="Remove image"
        >
          <X className="w-3 h-3 text-background" />
        </button>
      )}
      
      {/* Overlay on hover */}
      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    </div>
  );
};
