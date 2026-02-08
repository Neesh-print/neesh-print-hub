import { ButtonPrimary, ButtonSecondary } from '@/components/neesh';
import { MAGAZINE_FIELDS } from '@/lib/csvFieldMapping';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import type { ValidatedRow } from '@/lib/csvFieldMapping';

interface ValidationReviewStepProps {
  validatedRows: ValidatedRow[];
  excludedRows: Set<number>;
  columnMapping: Record<string, string>;
  onToggleExclude: (rowIndex: number) => void;
  onImport: () => void;
  onBack: () => void;
  validCount: number;
  errorCount: number;
  isImporting: boolean;
}

export function ValidationReviewStep({
  validatedRows,
  excludedRows,
  columnMapping,
  onToggleExclude,
  onImport,
  onBack,
  validCount,
  errorCount,
  isImporting,
}: ValidationReviewStepProps) {
  const mappedFields = MAGAZINE_FIELDS.filter((f) => !!columnMapping[f.key]);
  const totalActive = validatedRows.length - excludedRows.size;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Validate & Review</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Review your data before importing. Rows with errors can be excluded.
        </p>
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 border border-border">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <span className="text-sm font-medium">{validCount} valid</span>
        </div>
        {errorCount > 0 && (
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-500" />
            <span className="text-sm font-medium">{errorCount} with errors</span>
          </div>
        )}
        {excludedRows.size > 0 && (
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <span className="text-sm font-medium">{excludedRows.size} excluded</span>
          </div>
        )}
        <span className="text-sm text-muted-foreground ml-auto">
          {totalActive} of {validatedRows.length} rows active
        </span>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase w-10">
                #
              </th>
              <th className="px-3 py-3 text-center text-xs font-medium text-muted-foreground uppercase w-16">
                Status
              </th>
              {mappedFields.slice(0, 6).map((f) => (
                <th
                  key={f.key}
                  className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase"
                >
                  {f.label}
                </th>
              ))}
              <th className="px-3 py-3 text-center text-xs font-medium text-muted-foreground uppercase w-20">
                Include
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-background">
            {validatedRows.map((row) => {
              const isExcluded = excludedRows.has(row.rowIndex);
              const errorsByField = new Map(
                row.errors.map((e) => [e.field, e.message])
              );

              return (
                <tr
                  key={row.rowIndex}
                  className={isExcluded ? 'opacity-40' : ''}
                >
                  <td className="px-3 py-3 text-sm text-muted-foreground">
                    {row.rowIndex + 1}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {row.isValid ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600 mx-auto" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500 mx-auto" />
                    )}
                  </td>
                  {mappedFields.slice(0, 6).map((f) => {
                    const error = errorsByField.get(f.key);
                    const value = row.data[f.key];
                    return (
                      <td key={f.key} className="px-3 py-3">
                        <div className="text-sm text-foreground truncate max-w-[180px]">
                          {value != null ? String(value) : '-'}
                        </div>
                        {error && (
                          <p className="text-xs text-destructive mt-0.5">{error}</p>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={!isExcluded}
                      onChange={() => onToggleExclude(row.rowIndex)}
                      className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between pt-2">
        <ButtonSecondary onClick={onBack} disabled={isImporting}>
          Back
        </ButtonSecondary>
        <ButtonPrimary
          onClick={onImport}
          disabled={validCount === 0 || isImporting}
        >
          {isImporting ? 'Importing...' : `Import ${validCount} Titles`}
        </ButtonPrimary>
      </div>
    </div>
  );
}
