import { useCallback, useState } from "react";
import { Upload, X, FileText, Loader2 } from "lucide-react";
import { ImagePreview } from "@/components/ui/ImagePreview";

export interface UploadedFile {
  name: string;
  url?: string;
}

export interface FileUploadZoneProps {
  title: string;
  subtitle?: string;
  accept?: string;
  multiple?: boolean;
  onFilesSelected: (files: File[]) => void;
  currentFiles?: UploadedFile[];
  onRemoveFile?: (index: number) => void;
  // New props for upload state
  isUploading?: boolean;
  uploadProgress?: number;
  uploadedUrl?: string; // Show preview if already uploaded
  error?: string;
  onRemove?: () => void; // For removing the uploaded image
}

export const FileUploadZone = ({
  title,
  subtitle,
  accept = '*',
  multiple = false,
  onFilesSelected,
  currentFiles = [],
  onRemoveFile,
  isUploading = false,
  uploadProgress = 0,
  uploadedUrl,
  error,
  onRemove,
}: FileUploadZoneProps) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!isUploading) {
      setIsDragging(true);
    }
  }, [isUploading]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (isUploading) return;
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      onFilesSelected(multiple ? files : [files[0]]);
    }
  }, [multiple, onFilesSelected, isUploading]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (isUploading) return;
    
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onFilesSelected(multiple ? files : [files[0]]);
    }
    // Reset input value to allow selecting the same file again
    e.target.value = '';
  }, [multiple, onFilesSelected, isUploading]);

  const isImage = (fileName: string) => {
    return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(fileName);
  };

  // If there's an uploaded URL, show the preview state
  if (uploadedUrl) {
    return (
      <div className="w-full">
        <div className="relative group">
          <div className="aspect-[4/3] w-full rounded-lg overflow-hidden border border-border bg-secondary">
            <img
              src={uploadedUrl}
              alt="Uploaded image"
              className="w-full h-full object-cover"
            />
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <label className="cursor-pointer px-4 py-2 bg-background/90 rounded-lg text-sm font-medium hover:bg-background transition-colors">
                Change
                <input
                  type="file"
                  accept={accept}
                  onChange={handleFileSelect}
                  className="sr-only"
                />
              </label>
            </div>
          </div>
          {/* Remove button */}
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="absolute top-2 right-2 p-1.5 bg-foreground/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-foreground"
              aria-label="Remove image"
            >
              <X className="w-4 h-4 text-background" />
            </button>
          )}
        </div>
        {error && (
          <p className="mt-2 text-sm text-destructive">{error}</p>
        )}
      </div>
    );
  }

  return (
    <div className="w-full">
      <label
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          flex flex-col items-center justify-center
          w-full min-h-[160px] p-6
          bg-input rounded-lg border-2
          transition-all
          ${isUploading 
            ? 'border-solid border-accent cursor-wait' 
            : isDragging 
              ? 'border-accent bg-accent/5 border-dashed cursor-pointer' 
              : error
                ? 'border-destructive border-dashed cursor-pointer'
                : 'border-border border-dashed hover:border-accent/50 cursor-pointer'
          }
        `}
      >
        <input
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileSelect}
          className="sr-only"
          disabled={isUploading}
        />
        
        {isUploading ? (
          <>
            <Loader2 className="w-8 h-8 mb-3 text-accent animate-spin" />
            <p className="font-display font-medium text-body text-foreground text-center">
              Uploading...
            </p>
            {uploadProgress > 0 && (
              <div className="w-full max-w-32 mt-3 h-1.5 bg-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-accent transition-all duration-300" 
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}
          </>
        ) : (
          <>
            <Upload className={`w-8 h-8 mb-3 ${isDragging ? 'text-accent' : error ? 'text-destructive' : 'text-muted-foreground'}`} />
            
            <p className="font-display font-medium text-body text-foreground text-center">
              {title}
            </p>
            
            {subtitle && (
              <p className="mt-1 text-caption text-muted-foreground text-center">
                {subtitle}
              </p>
            )}
            
            <p className="mt-2 text-caption text-muted-foreground">
              Drag and drop or <span className="text-accent">browse</span>
            </p>
          </>
        )}
      </label>

      {/* Error message */}
      {error && !isUploading && (
        <p className="mt-2 text-sm text-destructive">{error}</p>
      )}

      {/* Uploaded files list (for legacy compatibility) */}
      {currentFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          {currentFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 bg-input rounded-lg"
            >
              {file.url && isImage(file.name) ? (
                <img
                  src={file.url}
                  alt={file.name}
                  className="w-10 h-10 object-cover rounded"
                />
              ) : (
                <div className="w-10 h-10 flex items-center justify-center bg-secondary rounded">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                </div>
              )}
              
              <span className="flex-1 text-body text-foreground truncate">
                {file.name}
              </span>
              
              {onRemoveFile && (
                <button
                  type="button"
                  onClick={() => onRemoveFile(index)}
                  className="p-1 rounded hover:bg-secondary transition-colors"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
