import { useState, useRef } from "react";
import { Camera, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ProfileImageUploadProps {
  currentImageUrl: string | null;
  userId: string;
  onUpload: (url: string) => void;
  onRemove: () => void;
}

export function ProfileImageUpload({ 
  currentImageUrl, 
  userId, 
  onUpload, 
  onRemove 
}: ProfileImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a JPG, PNG, or WebP image.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Image must be under 5MB.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Generate unique filename
      const ext = file.name.split('.').pop();
      const filename = `${userId}/${Date.now()}.${ext}`;

      // Simulate progress (Supabase doesn't provide real progress)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 100);

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('retailer-profiles')
        .upload(filename, file, {
          cacheControl: '3600',
          upsert: true,
        });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (error) {
        throw error;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('retailer-profiles')
        .getPublicUrl(filename);

      onUpload(publicUrl);

      toast({
        title: "Image uploaded",
        description: "Your profile image has been updated.",
      });
    } catch (error) {
      console.error('Upload failed:', error);
      toast({
        title: "Upload failed",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove();
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        onClick={handleClick}
        className={cn(
          "relative w-32 h-32 rounded-full overflow-hidden cursor-pointer",
          "bg-secondary border-2 border-dashed border-border",
          "hover:border-primary/50 transition-colors",
          "flex items-center justify-center group"
        )}
      >
        {currentImageUrl ? (
          <>
            <img
              src={currentImageUrl}
              alt="Profile"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera className="w-8 h-8 text-white" />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            {isUploading ? (
              <Loader2 className="w-8 h-8 animate-spin" />
            ) : (
              <>
                <Camera className="w-8 h-8" />
                <span className="text-xs">Upload logo</span>
              </>
            )}
          </div>
        )}

        {isUploading && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-secondary">
            <div 
              className="h-full bg-primary transition-all duration-200"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        )}
      </div>

      {currentImageUrl && !isUploading && (
        <button
          type="button"
          onClick={handleRemove}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-destructive transition-colors"
        >
          <X className="w-4 h-4" />
          Remove
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />
      
      <p className="text-xs text-muted-foreground text-center">
        Upload a square image (recommended: 400×400px)
      </p>
    </div>
  );
}
