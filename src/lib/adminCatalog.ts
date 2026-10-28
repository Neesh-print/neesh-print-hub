/**
 * Admin v2 Catalog: a title's status and what's wrong with it.
 *
 * is_active stores the status: true = live, null = suspended (hidden while
 * an admin looks into it), false = archived.
 */

export type TitleStatus = "live" | "suspended" | "archived";

export type TitleProblem =
  | "no_title"
  | "no_price"
  | "no_retail_price"
  | "no_weight"
  | "no_cover"
  | "out_of_stock"
  | "low_stock";

export const PROBLEM_LABEL: Record<TitleProblem, string> = {
  no_title: "No title",
  no_price: "No wholesale price",
  no_retail_price: "No retail price",
  no_weight: "No weight",
  no_cover: "No cover",
  out_of_stock: "Out of stock",
  low_stock: "Low stock",
};

/** Problems that stop a live title from selling or shipping properly. */
const BLOCKING: TitleProblem[] = ["no_title", "no_price", "no_weight", "out_of_stock"];

export const LOW_STOCK_AT = 10;

export interface CatalogTitle {
  id: string;
  title: string | null;
  issue: string | null;
  coverUrl: string | null;
  publisherId: string;
  publisherName: string;
  isActive: boolean | null;
  wholesalePrice: number | null;
  retailPrice: number | null;
  weightGrams: number | null;
  inventory: number | null;
  /** Neesh-handled stock isn't counted here; only publisher-handled titles run out. */
  publisherHandled: boolean;
}

export const statusOf = (isActive: boolean | null): TitleStatus =>
  isActive === true ? "live" : isActive === false ? "archived" : "suspended";

export function problemsOf(t: CatalogTitle): TitleProblem[] {
  const problems: TitleProblem[] = [];
  if (!t.title?.trim()) problems.push("no_title");
  if (t.wholesalePrice == null) problems.push("no_price");
  if (t.retailPrice == null) problems.push("no_retail_price");
  if (!t.weightGrams) problems.push("no_weight");
  if (!t.coverUrl) problems.push("no_cover");
  if (t.publisherHandled) {
    if (t.inventory == null || t.inventory <= 0) problems.push("out_of_stock");
    else if (t.inventory <= LOW_STOCK_AT) problems.push("low_stock");
  }
  return problems;
}

/** A live title with something that keeps it from selling or shipping. */
export const needsAttention = (t: CatalogTitle) =>
  statusOf(t.isActive) === "live" && problemsOf(t).some((p) => BLOCKING.includes(p));

export type CatalogView = "all" | "live" | "needs_attention" | "low_stock" | "suspended" | "archived";

export function inCatalogView(t: CatalogTitle, view: CatalogView): boolean {
  const status = statusOf(t.isActive);
  switch (view) {
    case "all":
      return true;
    case "live":
      return status === "live";
    case "needs_attention":
      return needsAttention(t);
    case "low_stock":
      return status === "live" && problemsOf(t).includes("low_stock");
    case "suspended":
      return status === "suspended";
    case "archived":
      return status === "archived";
  }
}

/** The title, or "Untitled" when it's blank. */
export const displayTitle = (t: Pick<CatalogTitle, "title" | "issue">) => t.title?.trim() || "Untitled";
