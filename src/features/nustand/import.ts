import Papa from "papaparse";
import { emptyReview, parsePilot, prospectSchema, type Row } from "./model";

export const MAX_SPACES = 500;
const normalize = (value: string) =>
  value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
const header = (value: string) => normalize(value).replace(/[ _-]/g, "");

export async function parseCsv(content: string): Promise<Row[]> {
  const parsed = Papa.parse<string[]>(content.replace(/^\uFEFF/, ""), {
    skipEmptyLines: "greedy",
  });
  if (parsed.errors.length)
    throw new Error(`CSV could not be parsed: ${parsed.errors[0].message}`);
  const [columns, ...data] = parsed.data;
  if (!columns || !data.length)
    throw new Error("CSV needs a header and at least one space.");
  if (data.length > MAX_SPACES)
    throw new Error(`Import at most ${MAX_SPACES} spaces per file.`);
  const keys = columns.map(header);
  if (keys.some((k) => !k) || new Set(keys).size !== keys.length)
    throw new Error("CSV headers must be nonempty and unique.");
  const nameIndex = keys.indexOf("name");
  if (nameIndex < 0)
    throw new Error(
      "CSV needs a Name column. Optional columns: Address, City, Notes, Website, ID.",
    );
  const rows: Row[] = [];
  const ids = new Set<string>();
  for (let i = 0; i < data.length; i++) {
    const values = data[i];
    const label = `CSV row ${i + 2}`;
    if (values.length !== columns.length)
      throw new Error(
        `${label} has a different number of fields than the header.`,
      );
    const field = (key: string) => values[keys.indexOf(key)]?.trim() || "";
    const name = field("name"),
      address = field("address"),
      city = field("city"),
      explicitId = field("id");
    if (!name) throw new Error(`${label} needs a Name.`);
    if (!explicitId && !address && !city)
      throw new Error(
        `${label} needs Address, City or an ID to identify the space.`,
      );
    const identity = explicitId
      ? ["id", normalize(explicitId)]
      : ["space", normalize(name), normalize(address), normalize(city)];
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(JSON.stringify(identity)),
    );
    const id =
      "csv:" +
      Array.from(new Uint8Array(digest), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");
    if (ids.has(id))
      throw new Error(
        `${label} repeats another space identity. Remove the duplicate or supply distinct IDs for separate locations.`,
      );
    ids.add(id);
    const original = Object.fromEntries(columns.map((c, n) => [c, values[n]]));
    // Preserve original cells and provide the established lowercase source fields.
    const source = prospectSchema.parse({
      id,
      name,
      city,
      website: field("website") || null,
      do_not_contact: ["true", "yes", "1"].includes(
        normalize(field("donotcontact")),
      ),
      original_record: {
        ...original,
        address,
        notes: field("notes"),
        city,
        name,
      },
      contacts: [],
      job: { status: "not_started" },
      fit: {
        score: null,
        uncertainties: [
          "CSV import; contact enrichment and fit review have not run.",
        ],
      },
      import_source: "csv",
    });
    rows.push({ source, review: emptyReview(), version: 0 });
  }
  return rows;
}

export async function parseImport(
  name: string,
  content: string,
): Promise<Row[]> {
  if (/\.csv$/i.test(name)) return parseCsv(content);
  try {
    return parsePilot(JSON.parse(content));
  } catch (error) {
    if (error instanceof SyntaxError)
      throw new Error("Choose a CSV list or a valid pilot results JSON file.");
    throw error;
  }
}
