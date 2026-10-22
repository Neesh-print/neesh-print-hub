import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { DataTable, StatusBadge, type DataTableColumn } from "@/components/neesh";
import { useReferenceShipping } from "@/hooks/useReferenceShipping";
import {
  REFERENCE_ORDER_COPIES,
  breakEvenCopies,
  countryName,
  healthyCopies,
  landedMargin,
  suggestHealthyRetail,
  type MarginBand,
} from "@/lib/shipping";
import { MARGIN_BADGE_STATUS, marginBandLabel, money, percent, signedMoney } from "@/lib/shippingCopy";

const QUANTITIES = [1, 5, 10, 20];

interface Row extends Record<string, unknown> {
  id: string;
  copies: string;
  cost: string;
  ship: string;
  rev: string;
  keeps: string;
  pct: string;
  band: MarginBand;
}

interface SpaceEarnsTableProps {
  publisherId: string | null | undefined;
  wsp: number;
  srp: number;
  weightGrams: number | null;
  widthMm?: number | null;
  heightMm?: number | null;
  titleMinimum?: number;
}

/**
 * "What a space earns" (T13, decision 6): a New York space buying this title,
 * at live shipping from the publisher. Never suggests lowering wholesale.
 */
export const SpaceEarnsTable = ({ publisherId, wsp, srp, weightGrams, widthMm, heightMm, titleMinimum = 1 }: SpaceEarnsTableProps) => {
  const ready = wsp > 0 && srp > 0 && !!weightGrams && weightGrams > 0;
  const ref = useReferenceShipping({
    publisherId,
    enabled: ready,
    lines: ready
      ? QUANTITIES.map((q) => ({ key: `q${q}`, copies: q, weight_grams: weightGrams!, wsp, width_mm: widthMm, height_mm: heightMm }))
      : [],
  });

  const minimum = Math.max(titleMinimum, ref.zone === "international" ? ref.intlMinCopies : 1);

  let body: ReactNode;
  if (!ready) {
    body = <p className="text-sm text-muted-foreground">Add a wholesale price, retail price and weight to see what a space earns.</p>;
  } else if (ref.isLoading) {
    body = <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Getting live rates...</div>;
  } else if (ref.problem === "needs_origin") {
    body = (
      <p className="text-sm text-muted-foreground">
        Add your ships-from address in <Link className="text-accent hover:underline" to="/publisher/settings">Settings</Link> to see live shipping.
      </p>
    );
  } else if (ref.problem === "no_rate") {
    body = (
      <p className="text-sm text-muted-foreground">
        No live carrier rate from {countryName(ref.originCountry) || "your country"} to New York. Set your own flat rates in{" "}
        <Link className="text-accent hover:underline" to="/publisher/settings">Settings</Link> so spaces can check out.
      </p>
    );
  } else {
    const quotes = QUANTITIES.flatMap((q) => {
      const ship = ref.byKey.get(`q${q}`);
      return ship === null || ship === undefined ? [] : [{ quantity: q, shippingUsd: ship }];
    });
    const rows: Row[] = quotes.map(({ quantity, shippingUsd }) => {
      const m = landedMargin({ wsp, srp, quantity, shippingUsd });
      return {
        id: String(quantity),
        copies: quantity < minimum ? `${quantity} (below minimum)` : String(quantity),
        cost: money(m.cost),
        ship: money(shippingUsd),
        rev: money(m.revenue),
        keeps: signedMoney(m.margin),
        pct: percent(m.marginPct),
        band: m.band,
      };
    });
    const eligible = quotes.filter((q) => q.quantity >= minimum);
    const be = breakEvenCopies(wsp, srp, eligible);
    const hq = healthyCopies(wsp, srp, eligible);
    const ten = quotes.find((q) => q.quantity === REFERENCE_ORDER_COPIES);
    const need = ten ? suggestHealthyRetail({ wsp, srp, quantity: ten.quantity, shippingUsd: ten.shippingUsd }) : null;

    const columns: DataTableColumn<Row>[] = [
      { key: "copies", header: "Copies", render: (v) => <span className="font-semibold">{String(v)}</span> },
      { key: "cost", header: "Space pays", align: "right" },
      { key: "ship", header: "Shipping", align: "right", render: (v) => <span className="text-muted-foreground">{String(v)}</span> },
      { key: "rev", header: "Sells for", align: "right" },
      {
        key: "keeps", header: "Space keeps", align: "right",
        render: (v, row) => <span className="font-semibold">{String(v)} <span className="text-muted-foreground font-normal">{row.pct}</span></span>,
      },
      { key: "band", header: "", render: (_v, row) => <StatusBadge status={MARGIN_BADGE_STATUS[row.band]} label={marginBandLabel(row.band)} /> },
    ];

    body = (
      <>
        <div className="-mx-6">
          <DataTable columns={columns} data={rows} />
        </div>
        <div className="mt-4 p-4 rounded-lg bg-secondary/50">
          <p className="font-display font-semibold text-base">
            {be === null ? "Never breaks even at these prices." : `Breaks even at ${be} copies.`}
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            {hq !== null
              ? `Healthy (25%+) at ${hq} copies.`
              : need !== null
                ? `Retail price of ${money(need)} makes ${REFERENCE_ORDER_COPIES} copies Healthy (25%+).`
                : ""}
          </p>
        </div>
      </>
    );
  }

  return (
    <div className="card-neesh">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold text-heading text-foreground">What a space earns</h3>
        <span className="text-caption uppercase tracking-wide text-muted-foreground">New York</span>
      </div>
      {body}
    </div>
  );
};
