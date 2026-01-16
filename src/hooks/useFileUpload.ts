import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface UseFileUploadOptions {
  bucket: string;
  folder?: string; // e.g., "covers", "spreads", "logos"
  maxSizeMB?: number;
  allowedTypes?: string[];
  onUploadComplete?: (url: string) => void;
  onError?: (error: string) => void;
}

export interface UseFileUploadReturn {
  upload: (file: File) => Promise<string | null>;
  uploadMultiple: (files: File[]) => Promise<string[]>;
  isUploading: boolean;
  progress: number; // 0-100
  error: string | null;
  reset: () => void;
}

export const useFileUpload = (options: UseFileUploadOptions): UseFileUploadReturn => {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const { user } = useAuth();

  const upload = useCallback(async (file: File): Promise<string | null> => {
    if (!user) {
      const errorMsg = "You must be logged in to upload files";
      setError(errorMsg);
      options.onError?.(errorMsg);
      return null;
    }

    // Validate file size
    const maxSize = (options.maxSizeMB || 5) * 1024 * 1024;
    if (file.size > maxSize) {
      const errorMsg = `File too large. Maximum size is ${options.maxSizeMB || 5}MB`;
      setError(errorMsg);
      options.onError?.(errorMsg);
      return null;
    }

    // Validate file type
    const allowedTypes = options.allowedTypes || ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      const errorMsg = 'Invalid file type. Please upload a JPG, PNG, WebP, or GIF image.';
      setError(errorMsg);
      options.onError?.(errorMsg);
      return null;
    }

    setIsUploading(true);
    setError(null);
    setProgress(10); // Initial progress

    try {
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const folder = options.folder || 'uploads';
      const path = `${user.id}/${folder}/${timestamp}-${safeName}`;

      setProgress(30);

      const { data, error: uploadError } = await supabase.storage
        .from(options.bucket)
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw uploadError;
      }

      setProgress(80);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(options.bucket)
        .getPublicUrl(path);

      const publicUrl = urlData.publicUrl;
      
      setProgress(100);
      options.onUploadComplete?.(publicUrl);
      
      return publicUrl;

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed. Please try again.';
      setError(message);
      options.onError?.(message);
      return null;
    } finally {
      setIsUploading(false);
    }
  }, [user, options]);

  const uploadMultiple = useCallback(async (files: File[]): Promise<string[]> => {
    const urls: string[] = [];
    const totalFiles = files.length;
    
    for (let i = 0; i < files.length; i++) {
      setProgress(Math.round((i / totalFiles) * 100));
      const url = await upload(files[i]);
      if (url) urls.push(url);
    }
    
    setProgress(100);
    return urls;
  }, [upload]);

  const reset = useCallback(() => {
    setError(null);
    setProgress(0);
    setIsUploading(false);
  }, []);

  return { upload, uploadMultiple, isUploading, progress, error, reset };
};
