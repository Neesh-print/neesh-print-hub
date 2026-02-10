import { useNavigate } from 'react-router-dom';
import { PublisherLayout } from '@/components/publisher/PublisherLayout';
import { BackNavigation } from '@/components/neesh';
import { usePublisherProfile } from '@/hooks/usePublisherProfile';
import { useBulkImport } from '@/hooks/useBulkImport';
import {
  CSVUploadStep,
  ColumnMappingStep,
  ValidationReviewStep,
  ImportResultsStep,
} from '@/components/bulk-import';
import { Loader2 } from 'lucide-react';

const STEP_LABELS: Record<string, string> = {
  upload: 'Upload CSV',
  mapping: 'Map Columns',
  validation: 'Review',
  results: 'Results',
};

export function PublisherBulkImport() {
  const navigate = useNavigate();
  const { publisher, isLoading: publisherLoading } = usePublisherProfile();

  const {
    step,
    csvHeaders,
    sampleRows,
    columnMapping,
    validatedRows,
    excludedRows,
    isImporting,
    importProgress,
    importResults,
    fileName,
    parseCSV,
    updateMapping,
    runValidation,
    toggleExcludeRow,
    runImport,
    reset,
    goBack,
    getValidCount,
    getErrorCount,
  } = useBulkImport();

  const handleBack = () => {
    if (step === 'upload') {
      navigate('/publisher/titles');
    } else {
      goBack();
    }
  };

  const handleDone = () => {
    reset();
    navigate('/publisher/titles');
  };

  if (publisherLoading) {
    return (
      <PublisherLayout>
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </PublisherLayout>
    );
  }

  return (
    <PublisherLayout>
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <BackNavigation
          title="Import Titles from CSV"
          onBack={handleBack}
          rightContent={
            <span className="text-sm text-muted-foreground">
              Step: {STEP_LABELS[step]}
            </span>
          }
        />

        <div className="mt-6">
          {step === 'upload' && (
            <CSVUploadStep
              onFileSelected={parseCSV}
              fileName={fileName}
            />
          )}

          {step === 'mapping' && (
            <ColumnMappingStep
              csvHeaders={csvHeaders}
              sampleRows={sampleRows}
              columnMapping={columnMapping}
              onUpdateMapping={updateMapping}
              onContinue={runValidation}
              onBack={goBack}
            />
          )}

          {step === 'validation' && (
            <ValidationReviewStep
              validatedRows={validatedRows}
              excludedRows={excludedRows}
              columnMapping={columnMapping}
              onToggleExclude={toggleExcludeRow}
              onImport={() => publisher && runImport(publisher.id)}
              onBack={goBack}
              validCount={getValidCount()}
              errorCount={getErrorCount()}
              isImporting={isImporting}
            />
          )}

          {step === 'results' && importResults && (
            <ImportResultsStep
              results={importResults}
              importProgress={importProgress}
              isImporting={isImporting}
              validatedRows={validatedRows}
              excludedRows={excludedRows}
              onDone={handleDone}
            />
          )}
        </div>
      </div>
    </PublisherLayout>
  );
}

export default PublisherBulkImport;
