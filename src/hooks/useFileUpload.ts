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
  // Set to true to use server-side validation (recommended for production)
  useServerValidation?: boolean;
  // Allow anonymous uploads (handled by edge function)
  allowAnonymous?: boolean;
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
  
  const { user, session } = useAuth();

  const uploadWithServerValidation = useCallback(async (file: File): Promise<string | null> => {
    if ((!user || !session) && !options.allowAnonymous) {
      const errorMsg = "You must be logged in to upload files";
      setError(errorMsg);
      options.onError?.(errorMsg);
      return null;
    }

    setIsUploading(true);
    setError(null);
    setProgress(10);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bucket', options.bucket);
      formData.append('folder', options.folder || 'uploads');
      if (options.allowAnonymous) {
        formData.append('isAnonymous', 'true');
      }

      setProgress(30);

      const { data, error: invokeError } = await supabase.functions.invoke('validate-upload', {
        body: formData,
      });

      if (invokeError) {
        throw new Error(invokeError.message || 'Upload failed');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setProgress(100);
      const url = data.url;
      options.onUploadComplete?.(url);
      return url;

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed. Please try again.';
      setError(message);
      options.onError?.(message);
      return null;
    } finally {
      setIsUploading(false);
    }
  }, [user, session, options]);

  const uploadDirect = useCallback(async (file: File): Promise<string | null> => {
    if (!user) {
      const errorMsg = "You must be logged in to upload files";
      setError(errorMsg);
      options.onError?.(errorMsg);
      return null;
    }

    // Client-side validation (fallback, not secure for production)
    const maxSize = (options.maxSizeMB || 5) * 1024 * 1024;
    if (file.size > maxSize) {
      const errorMsg = `File too large. Maximum size is ${options.maxSizeMB || 5}MB`;
      setError(errorMsg);
      options.onError?.(errorMsg);
      return null;
    }

    const allowedTypes = options.allowedTypes || ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      const errorMsg = 'Invalid file type. Please upload a JPG, PNG, WebP, or GIF image.';
      setError(errorMsg);
      options.onError?.(errorMsg);
      return null;
    }

    setIsUploading(true);
    setError(null);
    setProgress(10);

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

  const upload = useCallback(async (file: File): Promise<string | null> => {
    // Use server validation by default for security
    if (options.useServerValidation !== false) {
      return uploadWithServerValidation(file);
    }
    return uploadDirect(file);
  }, [options.useServerValidation, uploadWithServerValidation, uploadDirect]);

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
