import { ImageOff } from "lucide-react";

interface ImagePlaceholderProps {
  className?: string;
  iconClassName?: string;
  label?: string;
}

export const ImagePlaceholder = ({ 
  className = "", 
  iconClassName = "w-8 h-8", 
  label = "Image Coming Soon" 
}: ImagePlaceholderProps) => {
  return (
    <div className={`flex flex-col items-center justify-center bg-secondary text-muted-foreground w-full h-full p-4 text-center ${className}`}>
      <ImageOff className={`mb-2 opacity-50 ${iconClassName}`} />
      <span className="text-xs font-medium uppercase tracking-wider opacity-70">{label}</span>
    </div>
  );
};
