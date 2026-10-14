import { webcrypto } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import Papa from "papaparse";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { parseCsv, parseImport } from "./import";
beforeEach(() => vi.stubGlobal("crypto", webcrypto));
afterEach(() => vi.unstubAllGlobals());

it("preserves quoted notes and Unicode, creates stable IDs and no approved contacts", async () => {
  const csv =
    '\uFEFFName,Address,City,Notes\r\n"Café, Books",12 Main St,New York,"First line\nSecond line"';
  const [row] = await parseCsv(csv);
  expect(row.source.original_record.Notes).toBe("First line\nSecond line");
  expect(row.source.original_record.Address).toBe("12 Main St");
  expect(row.review.contacts).toEqual({});
  expect(row.source.contacts).toEqual([]);
  expect(row.source.job.status).toBe("not_started");
  expect(row.source.fit.score).toBeNull();
  const [same] = await parseCsv(
    'Notes,City,Address,Name\nChanged,NEW YORK,12 Main St,"Café, Books"',
  );
  expect(same.source.id).toBe(row.source.id);
});
it("rejects ambiguous rows, duplicate identities, duplicate headers and broken CSV", async () => {
  for (const csv of [
    "Name\nOnly a name",
    "Name,City\n,New York",
    "Name,City\nA,NY\nA,NY",
    "Name,name,City\nA,A,NY",
    'Name,City\n"A,NY',
    "Name,City\nA,NY,extra",
  ])
    await expect(parseCsv(csv)).rejects.toThrow();
  await expect(parseImport("list.json", "Name,City\nA,NY")).rejects.toThrow(
    "CSV",
  );
});
it("supports a 260-space list and enforces the 500-space file limit", async () => {
  const csv = (n: number) =>
    "Name,Address,City,Notes\n" +
    Array.from(
      { length: n },
      (_, i) => `Space ${i},${i} Main St,New York,Keep ${i}`,
    ).join("\n");
  expect(await parseCsv(csv(260))).toHaveLength(260);
  await expect(parseCsv(csv(501))).rejects.toThrow("500");
});
it.skipIf(!process.env.NUSTAND_CSV_SOURCE)(
  "preserves the supplied CSV cells in the actual import",
  async () => {
    const content = readFileSync(process.env.NUSTAND_CSV_SOURCE!, "utf8");
    const originals = Papa.parse<Record<string, string>>(content, {
      header: true,
      skipEmptyLines: "greedy",
    }).data;
    const rows = await parseCsv(content);
    expect(rows).toHaveLength(260);
    rows.forEach((r, i) =>
      Object.entries(originals[i]).forEach(([key, value]) =>
        expect(r.source.original_record[key]).toBe(value),
      ),
    );
    if (process.env.NUSTAND_CSV_VALIDATION_OUTPUT)
      writeFileSync(
        process.env.NUSTAND_CSV_VALIDATION_OUTPUT,
        JSON.stringify({
          schema_version: "0.2.2",
          records: rows.map((r) => r.source),
        }),
      );
  },
);
