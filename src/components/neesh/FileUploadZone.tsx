import { useCallback, useState } from "react";
import { Upload, X, FileText } from "lucide-react";

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
}

export const FileUploadZone = ({
  title,
  subtitle,
  accept = '*',
  multiple = false,
  onFilesSelected,
  currentFiles = [],
  onRemoveFile,
}: FileUploadZoneProps) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      onFilesSelected(multiple ? files : [files[0]]);
    }
  }, [multiple, onFilesSelected]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onFilesSelected(multiple ? files : [files[0]]);
    }
    // Reset input value to allow selecting the same file again
    e.target.value = '';
  }, [multiple, onFilesSelected]);

  const isImage = (fileName: string) => {
    return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(fileName);
  };

  return (
    <div className="w-full">
      <label
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          flex flex-col items-center justify-center
          w-full min-h-[160px] p-6
          bg-input rounded-lg border-2 border-dashed
          cursor-pointer transition-all
          ${isDragging 
            ? 'border-accent bg-accent/5' 
            : 'border-border hover:border-accent/50'
          }
        `}
      >
        <input
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileSelect}
          className="sr-only"
        />
        
        <Upload className={`w-8 h-8 mb-3 ${isDragging ? 'text-accent' : 'text-muted-foreground'}`} />
        
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
      </label>

      {/* Uploaded files */}
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
