import { FileUploadZone } from '@/components/neesh/FileUploadZone';
import { FormSelect } from '@/components/neesh/FormSelect';
import type { SelectOption } from '@/components/neesh/FormSelect';

interface CSVUploadStepProps {
  onFileSelected: (file: File) => void;
  fileName?: string;
  /** Admin-only: list of publishers to select from */
  publishers?: SelectOption[];
  selectedPublisherId?: string;
  onPublisherChange?: (id: string) => void;
}

export function CSVUploadStep({
  onFileSelected,
  fileName,
  publishers,
  selectedPublisherId,
  onPublisherChange,
}: CSVUploadStepProps) {
  const isAdminMode = !!publishers;
  const canUpload = !isAdminMode || !!selectedPublisherId;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Upload CSV</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Upload a CSV file with your magazine data. Each row will become a title.
        </p>
      </div>

      {isAdminMode && (
        <FormSelect
          label="Publisher"
          placeholder="Select a publisher..."
          options={publishers!}
          value={selectedPublisherId || ''}
          onChange={onPublisherChange}
          required
        />
      )}

      {canUpload ? (
        <FileUploadZone
          title={fileName || 'Upload your CSV file'}
          subtitle="Supports .csv files"
          accept=".csv,text/csv"
          onFilesSelected={(files) => {
            if (files[0]) onFileSelected(files[0]);
          }}
        />
      ) : (
        <div className="flex items-center justify-center min-h-[160px] p-6 bg-input rounded-lg border-2 border-dashed border-border opacity-50">
          <p className="text-muted-foreground text-sm">Select a publisher first to enable upload</p>
        </div>
      )}
    </div>
  );
}
