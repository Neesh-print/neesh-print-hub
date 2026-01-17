import { useState, useEffect, useCallback } from "react";

interface UseImageLoadOptions {
  src: string;
  fallbackSrc?: string;
}

interface UseImageLoadReturn {
  isLoaded: boolean;
  isLoading: boolean;
  isError: boolean;
  currentSrc: string;
  retry: () => void;
}

export function useImageLoad({
  src,
  fallbackSrc,
}: UseImageLoadOptions): UseImageLoadReturn {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);

  const loadImage = useCallback((imageSrc: string) => {
    setIsLoading(true);
    setIsError(false);

    const img = new Image();
    
    img.onload = () => {
      setIsLoaded(true);
      setIsLoading(false);
    };

    img.onerror = () => {
      setIsLoading(false);
      setIsError(true);
      
      if (fallbackSrc && imageSrc !== fallbackSrc) {
        setCurrentSrc(fallbackSrc);
      }
    };

    img.src = imageSrc;
  }, [fallbackSrc]);

  useEffect(() => {
    setIsLoaded(false);
    setCurrentSrc(src);
    loadImage(src);
  }, [src, loadImage]);

  useEffect(() => {
    if (currentSrc !== src && isError) {
      loadImage(currentSrc);
    }
  }, [currentSrc, src, isError, loadImage]);

  const retry = useCallback(() => {
    setCurrentSrc(src);
    loadImage(src);
  }, [src, loadImage]);

  return {
    isLoaded,
    isLoading,
    isError,
    currentSrc,
    retry,
  };
}

// Preload critical images
export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
}

// Preload multiple images
export function preloadImages(srcs: string[]): Promise<void[]> {
  return Promise.all(srcs.map(preloadImage));
}
