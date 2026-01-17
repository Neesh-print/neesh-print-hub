import { ReactNode } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

export interface DataTableColumn<T = Record<string, unknown>> {
  key: string;
  header: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  render?: (value: unknown, row: T) => ReactNode;
}

export interface DataTableProps<T = Record<string, unknown>> {
  columns: DataTableColumn<T>[];
  data: T[];
  selectable?: boolean;
  selectedRows?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  onSort?: (columnKey: string, direction: 'asc' | 'desc') => void;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  rowIdKey?: string;
  onRowClick?: (row: T) => void;
}

export const DataTable = <T extends Record<string, unknown>>({
  columns,
  data,
  selectable = false,
  selectedRows = [],
  onSelectionChange,
  onSort,
  sortColumn,
  sortDirection,
  rowIdKey = 'id',
  onRowClick,
}: DataTableProps<T>) => {
  const allSelected = data.length > 0 && selectedRows.length === data.length;
  const someSelected = selectedRows.length > 0 && selectedRows.length < data.length;

  const handleSelectAll = () => {
    if (!onSelectionChange) return;
    if (allSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(data.map((row) => String(row[rowIdKey])));
    }
  };

  const handleSelectRow = (rowId: string) => {
    if (!onSelectionChange) return;
    if (selectedRows.includes(rowId)) {
      onSelectionChange(selectedRows.filter((id) => id !== rowId));
    } else {
      onSelectionChange([...selectedRows, rowId]);
    }
  };

  const handleSort = (columnKey: string) => {
    if (!onSort) return;
    const newDirection = sortColumn === columnKey && sortDirection === 'asc' ? 'desc' : 'asc';
    onSort(columnKey, newDirection);
  };

  const getAlignClass = (align?: 'left' | 'center' | 'right') => {
    switch (align) {
      case 'center': return 'text-center';
      case 'right': return 'text-right';
      default: return 'text-left';
    }
  };

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[600px]">
        <thead>
          <tr className="border-b border-border">
            {selectable && (
              <th className="w-12 py-3 px-4">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={handleSelectAll}
                  className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
                  aria-label="Select all rows"
                />
              </th>
            )}
            {columns.map((column) => (
              <th
                key={column.key}
                className={`py-3 px-4 font-display font-semibold text-body ${getAlignClass(column.align)}`}
              >
                {column.sortable ? (
                  <button
                    onClick={() => handleSort(column.key)}
                    className="inline-flex items-center gap-1 hover:text-accent transition-colors"
                  >
                    {column.header}
                    <span className="flex flex-col">
                      <ChevronUp 
                        className={`w-3 h-3 -mb-1 ${
                          sortColumn === column.key && sortDirection === 'asc' 
                            ? 'text-foreground' 
                            : 'text-muted-foreground/50'
                        }`} 
                      />
                      <ChevronDown 
                        className={`w-3 h-3 ${
                          sortColumn === column.key && sortDirection === 'desc' 
                            ? 'text-foreground' 
                            : 'text-muted-foreground/50'
                        }`} 
                      />
                    </span>
                  </button>
                ) : (
                  column.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => {
            const rowId = String(row[rowIdKey]);
            const isSelected = selectedRows.includes(rowId);
            
            return (
              <tr
                key={rowId}
                className={`
                  border-b border-border last:border-b-0 transition-colors group
                  ${rowIndex % 2 === 1 ? 'bg-secondary' : 'bg-background'}
                  ${onRowClick ? 'cursor-pointer hover:bg-secondary/80' : ''}
                  ${isSelected ? 'bg-accent/5' : ''}
                `}
                onClick={() => onRowClick?.(row)}
              >
                {selectable && (
                  <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSelectRow(rowId)}
                      className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
                      aria-label={`Select row ${rowId}`}
                    />
                  </td>
                )}
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`py-3 px-4 text-body ${getAlignClass(column.align)}`}
                  >
                    {column.render 
                      ? column.render(row[column.key], row)
                      : String(row[column.key] ?? '')
                    }
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
