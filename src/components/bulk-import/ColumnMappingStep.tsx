import { MAGAZINE_FIELDS } from '@/lib/csvFieldMapping';
import { FormSelect } from '@/components/neesh/FormSelect';
import { ButtonPrimary, ButtonSecondary } from '@/components/neesh';
import { Badge } from '@/components/ui/badge';
import { REQUIRED_FIELDS } from '@/lib/csvFieldMapping';

interface ColumnMappingStepProps {
  csvHeaders: string[];
  sampleRows: Record<string, string>[];
  columnMapping: Record<string, string>;
  onUpdateMapping: (fieldKey: string, csvColumn: string) => void;
  onContinue: () => void;
  onBack: () => void;
}

export function ColumnMappingStep({
  csvHeaders,
  sampleRows,
  columnMapping,
  onUpdateMapping,
  onContinue,
  onBack,
}: ColumnMappingStepProps) {
  const requiredKeys = REQUIRED_FIELDS.map((f) => f.key);
  const allRequiredMapped = requiredKeys.every((key) => !!columnMapping[key]);

  const dropdownOptions = [
    { value: '', label: 'Skip' },
    ...csvHeaders.map((h) => ({ value: h, label: h })),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Map Columns</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Match your CSV columns to our magazine fields. Required fields are marked with a badge.
        </p>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Our Field
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Your CSV Column
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                Sample Values
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-background">
            {MAGAZINE_FIELDS.map((field) => {
              const selectedColumn = columnMapping[field.key] || '';
              const samples = selectedColumn
                ? sampleRows
                    .map((r) => r[selectedColumn])
                    .filter(Boolean)
                    .slice(0, 3)
                : [];

              return (
                <tr key={field.key}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {field.label}
                      </span>
                      {field.required && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                          Required
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <FormSelect
                      options={dropdownOptions}
                      value={selectedColumn}
                      onChange={(val) => onUpdateMapping(field.key, val)}
                      placeholder="Skip"
                    />
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {samples.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {samples.map((val, i) => (
                          <span
                            key={i}
                            className="inline-block text-xs bg-muted px-2 py-1 rounded text-muted-foreground max-w-[200px] truncate"
                          >
                            {val}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between pt-2">
        <ButtonSecondary onClick={onBack}>Back</ButtonSecondary>
        <ButtonPrimary onClick={onContinue} disabled={!allRequiredMapped}>
          Continue
        </ButtonPrimary>
      </div>
    </div>
  );
}
