import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { BackNavigation } from '@/components/neesh';
import { useBulkImport } from '@/hooks/useBulkImport';
import { supabase } from '@/integrations/supabase/client';
import {
  CSVUploadStep,
  ColumnMappingStep,
  ValidationReviewStep,
  ImportResultsStep,
} from '@/components/bulk-import';
import { Loader2 } from 'lucide-react';
import type { SelectOption } from '@/components/neesh/FormSelect';

const STEP_LABELS: Record<string, string> = {
  upload: 'Upload CSV',
  mapping: 'Map Columns',
  validation: 'Review',
  results: 'Results',
};

export function AdminBulkImport() {
  const navigate = useNavigate();
  const [publishers, setPublishers] = useState<SelectOption[]>([]);
  const [selectedPublisherId, setSelectedPublisherId] = useState('');
  const [loadingPublishers, setLoadingPublishers] = useState(true);

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

  useEffect(() => {
    async function fetchPublishers() {
      const { data } = await supabase
        .from('publishers')
        .select('id, company_name')
        .eq('application_status', 'approved')
        .order('company_name');

      if (data) {
        setPublishers(
          data.map((p) => ({
            value: p.id,
            label: p.company_name || 'Unnamed Publisher',
          }))
        );
      }
      setLoadingPublishers(false);
    }

    fetchPublishers();
  }, []);

  const handleBack = () => {
    if (step === 'upload') {
      navigate('/admin/magazines');
    } else {
      goBack();
    }
  };

  const handleDone = () => {
    reset();
    navigate('/admin/magazines');
  };

  if (loadingPublishers) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto">
        <BackNavigation
          title="Import Magazines from CSV"
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
              publishers={publishers}
              selectedPublisherId={selectedPublisherId}
              onPublisherChange={setSelectedPublisherId}
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
              onImport={() => runImport(selectedPublisherId)}
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
    </AdminLayout>
  );
}

export default AdminBulkImport;
