export interface MagazineField {
  key: string;
  label: string;
  required: boolean;
  type: 'string' | 'number' | 'date' | 'boolean';
  parse: (value: string) => unknown;
  aliases: string[];
}

export const MAGAZINE_FIELDS: MagazineField[] = [
  {
    key: 'title',
    label: 'Title',
    required: true,
    type: 'string',
    parse: (v) => v.trim(),
    aliases: ['title', 'name', 'magazine title', 'magazine name', 'publication title'],
  },
  {
    key: 'wholesale_price',
    label: 'Wholesale Price',
    required: true,
    type: 'number',
    parse: (v) => {
      const num = parseFloat(v.replace(/[^0-9.,-]/g, '').replace(',', '.'));
      return isNaN(num) ? undefined : num;
    },
    aliases: ['wholesale_price', 'wholesale price', 'wsp', 'cost', 'wholesale'],
  },
  {
    key: 'suggested_retail_price',
    label: 'Suggested Retail Price',
    required: false,
    type: 'number',
    parse: (v) => {
      const num = parseFloat(v.replace(/[^0-9.,-]/g, '').replace(',', '.'));
      return isNaN(num) ? undefined : num;
    },
    aliases: ['suggested_retail_price', 'retail price', 'srp', 'rrp', 'msrp', 'retail'],
  },
  {
    key: 'description',
    label: 'Description',
    required: false,
    type: 'string',
    parse: (v) => v.trim() || null,
    aliases: ['description', 'desc', 'about', 'summary', 'blurb'],
  },
  {
    key: 'category',
    label: 'Category',
    required: false,
    type: 'string',
    parse: (v) => v.trim() || null,
    aliases: ['category', 'genre', 'type'],
  },
  {
    key: 'subcategory',
    label: 'Subcategory',
    required: false,
    type: 'string',
    parse: (v) => v.trim() || null,
    aliases: ['subcategory', 'sub-category', 'sub category'],
  },
  {
    key: 'issue_number',
    label: 'Issue Number',
    required: false,
    type: 'string',
    parse: (v) => v.trim() || null,
    aliases: ['issue_number', 'issue number', 'issue', 'issue #', 'issue no', 'number'],
  },
  {
    key: 'issue_frequency',
    label: 'Issue Frequency',
    required: false,
    type: 'string',
    parse: (v) => v.trim() || null,
    aliases: ['issue_frequency', 'frequency', 'publication frequency', 'schedule'],
  },
  {
    key: 'publication_type',
    label: 'Publication Type',
    required: false,
    type: 'string',
    parse: (v) => v.trim() || null,
    aliases: ['publication_type', 'publication type', 'pub type', 'format'],
  },
  {
    key: 'publication_date',
    label: 'Publication Date',
    required: false,
    type: 'date',
    parse: (v) => {
      const trimmed = v.trim();
      if (!trimmed) return null;
      const d = new Date(trimmed);
      return isNaN(d.getTime()) ? undefined : d.toISOString().split('T')[0];
    },
    aliases: ['publication_date', 'publication date', 'pub date', 'publish date', 'date published', 'release date'],
  },
  {
    key: 'origin_country_code',
    label: 'Country Code',
    required: false,
    type: 'string',
    parse: (v) => v.trim().toUpperCase() || null,
    aliases: ['origin_country_code', 'country code', 'country', 'origin'],
  },
  {
    key: 'inventory_count',
    label: 'Inventory Count',
    required: false,
    type: 'number',
    parse: (v) => {
      const num = parseInt(v.replace(/[^0-9-]/g, ''), 10);
      return isNaN(num) ? undefined : num;
    },
    aliases: ['inventory_count', 'inventory', 'stock', 'qty', 'quantity', 'count', 'stock count'],
  },
  {
    key: 'isbn',
    label: 'ISBN',
    required: false,
    type: 'string',
    parse: (v) => v.trim().replace(/[-\s]/g, '') || null,
    aliases: ['isbn', 'isbn-13', 'isbn13', 'isbn-10', 'isbn10'],
  },
  {
    key: 'page_count',
    label: 'Page Count',
    required: false,
    type: 'number',
    parse: (v) => {
      const num = parseInt(v.replace(/[^0-9]/g, ''), 10);
      return isNaN(num) ? undefined : num;
    },
    aliases: ['page_count', 'pages', 'page count', 'number of pages'],
  },
  {
    key: 'width_mm',
    label: 'Width (mm)',
    required: false,
    type: 'number',
    parse: (v) => {
      const num = parseFloat(v.replace(/[^0-9.]/g, ''));
      return isNaN(num) ? undefined : num;
    },
    aliases: ['width_mm', 'width', 'width mm'],
  },
  {
    key: 'height_mm',
    label: 'Height (mm)',
    required: false,
    type: 'number',
    parse: (v) => {
      const num = parseFloat(v.replace(/[^0-9.]/g, ''));
      return isNaN(num) ? undefined : num;
    },
    aliases: ['height_mm', 'height', 'height mm'],
  },
  {
    key: 'weight_grams',
    label: 'Weight (g)',
    required: false,
    type: 'number',
    parse: (v) => {
      const num = parseFloat(v.replace(/[^0-9.]/g, ''));
      return isNaN(num) ? undefined : num;
    },
    aliases: ['weight_grams', 'weight', 'weight g', 'weight grams'],
  },
  {
    key: 'warehouse_location',
    label: 'Warehouse Location',
    required: false,
    type: 'string',
    parse: (v) => v.trim() || null,
    aliases: ['warehouse_location', 'warehouse', 'location'],
  },
  {
    key: 'restock_timeline',
    label: 'Restock Timeline',
    required: false,
    type: 'string',
    parse: (v) => v.trim() || null,
    aliases: ['restock_timeline', 'restock', 'restock time', 'lead time'],
  },
  {
    key: 'print_run',
    label: 'Print Run',
    required: false,
    type: 'number',
    parse: (v) => {
      const num = parseInt(v.replace(/[^0-9]/g, ''), 10);
      return isNaN(num) ? undefined : num;
    },
    aliases: ['print_run', 'print run', 'run size'],
  },
  {
    key: 'cover_image_url',
    label: 'Cover Image URL',
    required: false,
    type: 'string',
    parse: (v) => {
      const trimmed = v.trim();
      if (!trimmed) return null;
      try {
        new URL(trimmed);
        return trimmed;
      } catch {
        return undefined;
      }
    },
    aliases: ['cover_image_url', 'cover image url', 'cover url', 'image url', 'cover', 'image', 'cover image'],
  },
];

export const REQUIRED_FIELDS = MAGAZINE_FIELDS.filter((f) => f.required);

/**
 * Auto-match CSV headers to our field definitions by comparing
 * lowercase headers against each field's aliases.
 */
export function autoMatchColumns(
  csvHeaders: string[]
): Record<string, string> {
  const mapping: Record<string, string> = {};

  for (const field of MAGAZINE_FIELDS) {
    const lowerAliases = field.aliases.map((a) => a.toLowerCase());
    const match = csvHeaders.find((h) =>
      lowerAliases.includes(h.toLowerCase().trim())
    );
    if (match) {
      mapping[field.key] = match;
    }
  }

  return mapping;
}

export interface RowValidationError {
  field: string;
  message: string;
}

export interface ValidatedRow {
  rowIndex: number;
  data: Record<string, unknown>;
  errors: RowValidationError[];
  isValid: boolean;
}

/**
 * Validate and transform a single CSV row using the column mapping.
 */
export function validateRow(
  rawRow: Record<string, string>,
  columnMapping: Record<string, string>,
  rowIndex: number
): ValidatedRow {
  const errors: RowValidationError[] = [];
  const data: Record<string, unknown> = {};

  for (const field of MAGAZINE_FIELDS) {
    const csvColumn = columnMapping[field.key];
    if (!csvColumn) {
      if (field.required) {
        errors.push({ field: field.key, message: `${field.label} is required` });
      }
      continue;
    }

    const rawValue = rawRow[csvColumn];
    if (!rawValue || rawValue.trim() === '') {
      if (field.required) {
        errors.push({ field: field.key, message: `${field.label} is required` });
      }
      continue;
    }

    const parsed = field.parse(rawValue);
    if (parsed === undefined) {
      const typeLabel =
        field.type === 'number' ? 'a valid number' :
        field.type === 'date' ? 'a valid date' :
        'valid';
      errors.push({
        field: field.key,
        message: `${field.label} must be ${typeLabel}`,
      });
    } else {
      data[field.key] = parsed;
    }
  }

  return { rowIndex, data, errors, isValid: errors.length === 0 };
}

/**
 * Validate all rows in the CSV data.
 */
export function validateAllRows(
  rows: Record<string, string>[],
  columnMapping: Record<string, string>
): ValidatedRow[] {
  return rows.map((row, i) => validateRow(row, columnMapping, i));
}

/**
 * Prepare validated rows for Supabase insert by adding auto-fill fields.
 */
export function prepareForInsert(
  validatedRows: ValidatedRow[],
  publisherId: string
): Record<string, unknown>[] {
  return validatedRows
    .filter((r) => r.isValid)
    .map((r) => ({
      ...r.data,
      publisher_id: publisherId,
      price: r.data.wholesale_price, // price mirrors wholesale_price
      is_active: true,
    }));
}
