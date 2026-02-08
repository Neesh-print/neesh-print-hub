import { useState, useCallback } from 'react';
import Papa from 'papaparse';
import { supabase } from '@/integrations/supabase/client';
import {
  autoMatchColumns,
  validateAllRows,
  prepareForInsert,
  type ValidatedRow,
} from '@/lib/csvFieldMapping';

export type ImportStep = 'upload' | 'mapping' | 'validation' | 'results';

export interface ImportResults {
  imported: number;
  failed: number;
  importedIds: string[];
  errors: string[];
}

const BATCH_SIZE = 50;

export function useBulkImport() {
  const [step, setStep] = useState<ImportStep>('upload');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [sampleRows, setSampleRows] = useState<Record<string, string>[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [validatedRows, setValidatedRows] = useState<ValidatedRow[]>([]);
  const [excludedRows, setExcludedRows] = useState<Set<number>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<ImportResults | null>(null);
  const [fileName, setFileName] = useState<string>('');

  const parseCSV = useCallback((file: File) => {
    setFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || [];
        const rows = results.data;
        setCsvHeaders(headers);
        setCsvRows(rows);
        setSampleRows(rows.slice(0, 3));

        // Auto-match columns
        const autoMap = autoMatchColumns(headers);
        setColumnMapping(autoMap);

        setStep('mapping');
      },
      error: () => {
        // Error handled by component via returned state
      },
    });
  }, []);

  const updateMapping = useCallback((fieldKey: string, csvColumn: string) => {
    setColumnMapping((prev) => {
      if (!csvColumn) {
        const next = { ...prev };
        delete next[fieldKey];
        return next;
      }
      return { ...prev, [fieldKey]: csvColumn };
    });
  }, []);

  const runValidation = useCallback(() => {
    const results = validateAllRows(csvRows, columnMapping);
    setValidatedRows(results);
    setExcludedRows(new Set());
    setStep('validation');
  }, [csvRows, columnMapping]);

  const toggleExcludeRow = useCallback((rowIndex: number) => {
    setExcludedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowIndex)) {
        next.delete(rowIndex);
      } else {
        next.add(rowIndex);
      }
      return next;
    });
  }, []);

  const getActiveRows = useCallback(() => {
    return validatedRows.filter((r) => !excludedRows.has(r.rowIndex));
  }, [validatedRows, excludedRows]);

  const getValidCount = useCallback(() => {
    return getActiveRows().filter((r) => r.isValid).length;
  }, [getActiveRows]);

  const getErrorCount = useCallback(() => {
    return getActiveRows().filter((r) => !r.isValid).length;
  }, [getActiveRows]);

  const runImport = useCallback(
    async (publisherId: string) => {
      const activeValidRows = getActiveRows().filter((r) => r.isValid);
      if (activeValidRows.length === 0) return;

      setIsImporting(true);
      setImportProgress(0);

      const rows = prepareForInsert(activeValidRows, publisherId);
      const totalBatches = Math.ceil(rows.length / BATCH_SIZE);
      let imported = 0;
      let failed = 0;
      const importedIds: string[] = [];
      const errors: string[] = [];

      for (let i = 0; i < totalBatches; i++) {
        const batch = rows.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);

        const { data, error } = await supabase
          .from('magazines')
          .insert(batch as Record<string, unknown>[])
          .select('id');

        if (error) {
          failed += batch.length;
          errors.push(`Batch ${i + 1}: ${error.message}`);
        } else {
          imported += data.length;
          importedIds.push(...data.map((d: { id: string }) => d.id));
        }

        setImportProgress(Math.round(((i + 1) / totalBatches) * 100));
      }

      const results: ImportResults = { imported, failed, importedIds, errors };
      setImportResults(results);
      setIsImporting(false);
      setStep('results');
    },
    [getActiveRows]
  );

  const reset = useCallback(() => {
    setStep('upload');
    setCsvHeaders([]);
    setCsvRows([]);
    setSampleRows([]);
    setColumnMapping({});
    setValidatedRows([]);
    setExcludedRows(new Set());
    setIsImporting(false);
    setImportProgress(0);
    setImportResults(null);
    setFileName('');
  }, []);

  const goBack = useCallback(() => {
    if (step === 'mapping') setStep('upload');
    else if (step === 'validation') setStep('mapping');
  }, [step]);

  return {
    // State
    step,
    csvHeaders,
    csvRows,
    sampleRows,
    columnMapping,
    validatedRows,
    excludedRows,
    isImporting,
    importProgress,
    importResults,
    fileName,

    // Actions
    parseCSV,
    updateMapping,
    runValidation,
    toggleExcludeRow,
    runImport,
    reset,
    goBack,

    // Derived
    getActiveRows,
    getValidCount,
    getErrorCount,
  };
}
