/**
 * Every row of a Supabase query, a page at a time. The hosted API returns at
 * most 1,000 rows per request, so admin screens that need the whole table
 * page through it. `page(from, to)` builds the query with `.range(from, to)`;
 * give it a stable order so pages don't overlap.
 */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 1000,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return rows;
  }
}
