import { useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { FileText, Loader2, ExternalLink } from "lucide-react";
import { AdminLayout } from "@/components/admin";
import { BackNavigation } from "@/components/neesh";
import { useInvoices, type InvoiceStatus, type Invoice } from "@/hooks/useInvoices";
import { format } from "date-fns";

const STATUS_STYLES: Record<InvoiceStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-secondary text-muted-foreground" },
  open: { label: "Open", className: "bg-amber-100 text-amber-800" },
  paid: { label: "Paid", className: "bg-green-100 text-green-800" },
  overdue: { label: "Overdue", className: "bg-red-100 text-red-800" },
  void: { label: "Void", className: "bg-secondary text-muted-foreground" },
  uncollectible: { label: "Uncollectible", className: "bg-red-100 text-red-800" },
};

type Filter = "all" | "open" | "overdue" | "paid";

const daysOutstanding = (inv: Invoice): number | null => {
  if (!inv.due_at || inv.status === "paid" || inv.status === "void") return null;
  const diff = Date.now() - new Date(inv.due_at).getTime();
  return Math.floor(diff / 86_400_000);
};

export const AdminInvoices = () => {
  const navigate = useNavigate();
  const { invoices, isLoading } = useInvoices({ scope: "all" });
  const [filter, setFilter] = useState<Filter>("all");

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(price);

  const filtered = useMemo(() => {
    if (filter === "all") return invoices;
    return invoices.filter((i) => i.status === filter);
  }, [invoices, filter]);

  const outstanding = useMemo(
    () => invoices.filter((i) => i.status === "open" || i.status === "overdue").reduce((s, i) => s + i.amount_due, 0),
    [invoices]
  );
  const overdueTotal = useMemo(
    () => invoices.filter((i) => i.status === "overdue").reduce((s, i) => s + i.amount_due, 0),
    [invoices]
  );

  return (
    <AdminLayout>
      <BackNavigation title="Invoices & AR" onBack={() => navigate("/admin")} />

      <div className="px-4 md:px-6 pb-8">
        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="card-neesh">
            <p className="text-caption text-muted-foreground">Total outstanding</p>
            <p className="font-display font-bold text-display-sm text-foreground">{formatPrice(outstanding)}</p>
          </div>
          <div className="card-neesh">
            <p className="text-caption text-muted-foreground">Overdue</p>
            <p className="font-display font-bold text-display-sm text-red-700">{formatPrice(overdueTotal)}</p>
          </div>
          <div className="card-neesh">
            <p className="text-caption text-muted-foreground">Total invoices</p>
            <p className="font-display font-bold text-display-sm text-foreground">{invoices.length}</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-4">
          {(["all", "open", "overdue", "paid"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-sm capitalize transition-colors ${
                filter === f ? "bg-foreground text-background" : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="card-neesh flex flex-col items-center justify-center py-12">
            <FileText className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="text-body text-muted-foreground">No invoices in this view.</p>
          </div>
        ) : (
          <div className="card-neesh overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2 pr-4 font-medium">Retailer</th>
                  <th className="py-2 pr-4 font-medium">Total</th>
                  <th className="py-2 pr-4 font-medium">Due</th>
                  <th className="py-2 pr-4 font-medium">Due date</th>
                  <th className="py-2 pr-4 font-medium">Age</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => {
                  const style = STATUS_STYLES[inv.status];
                  const age = daysOutstanding(inv);
                  return (
                    <tr key={inv.id} className="border-b border-border/60 last:border-0">
                      <td className="py-3 pr-4 text-foreground">{inv.shop_name || inv.retailer_id.slice(0, 8)}</td>
                      <td className="py-3 pr-4 text-foreground">{formatPrice(inv.total)}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{formatPrice(inv.amount_due)}</td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {inv.due_at ? format(new Date(inv.due_at), "MMM d, yyyy") : "—"}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {age === null ? "—" : age > 0 ? `${age}d overdue` : `${-age}d left`}
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${style.className}`}>
                          {style.label}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        {inv.hosted_invoice_url && (
                          <a
                            href={inv.hosted_invoice_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent hover:underline inline-flex items-center"
                          >
                            View <ExternalLink className="ml-1 h-3 w-3" />
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminInvoices;
