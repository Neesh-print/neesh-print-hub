import { useNavigate } from "react-router-dom";
import { FileText, Loader2, ExternalLink } from "lucide-react";
import { RetailerLayout } from "@/components/retailer";
import { BackNavigation, ButtonPrimary, EmptyState } from "@/components/neesh";
import { useInvoices, type InvoiceStatus } from "@/hooks/useInvoices";
import { format } from "date-fns";

const STATUS_STYLES: Record<InvoiceStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-secondary text-muted-foreground" },
  open: { label: "Open", className: "bg-amber-100 text-amber-800" },
  paid: { label: "Paid", className: "bg-green-100 text-green-800" },
  overdue: { label: "Overdue", className: "bg-red-100 text-red-800" },
  void: { label: "Void", className: "bg-secondary text-muted-foreground" },
  uncollectible: { label: "Uncollectible", className: "bg-red-100 text-red-800" },
};

export const RetailerInvoices = () => {
  const navigate = useNavigate();
  const { invoices, isLoading, openTotal } = useInvoices();

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(price);

  return (
    <RetailerLayout>
      <BackNavigation title="Invoices" onBack={() => navigate("/retailer")} />

      <div className="px-4 md:px-6 pb-12">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="py-12">
            <EmptyState
              icon={<FileText className="w-12 h-12" />}
              title="No invoices yet"
              description="Invoices from orders placed on payment terms will appear here."
            />
          </div>
        ) : (
          <>
            {openTotal > 0 && (
              <div className="card-neesh mb-6 flex items-center justify-between">
                <div>
                  <p className="text-caption text-muted-foreground">Total outstanding</p>
                  <p className="font-display font-bold text-display-sm text-foreground">
                    {formatPrice(openTotal)}
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {invoices.map((inv) => {
                const style = STATUS_STYLES[inv.status];
                const payable = inv.status === "open" || inv.status === "overdue";
                return (
                  <div key={inv.id} className="card-neesh flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-display font-semibold text-foreground">
                          {formatPrice(inv.total)}
                        </span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${style.className}`}>
                          {style.label}
                        </span>
                        <span className="text-xs text-muted-foreground">Net {inv.terms_days}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {inv.due_at ? `Due ${format(new Date(inv.due_at), "MMM d, yyyy")}` : "No due date"}
                        {inv.amount_due > 0 && inv.status !== "paid" && (
                          <> · {formatPrice(inv.amount_due)} due</>
                        )}
                        {inv.paid_at && <> · Paid {format(new Date(inv.paid_at), "MMM d, yyyy")}</>}
                      </p>
                    </div>
                    {payable && inv.hosted_invoice_url && (
                      <a href={inv.hosted_invoice_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                        <ButtonPrimary>
                          Pay invoice
                          <ExternalLink className="ml-2 h-4 w-4" />
                        </ButtonPrimary>
                      </a>
                    )}
                    {!payable && inv.hosted_invoice_url && (
                      <a
                        href={inv.hosted_invoice_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-sm text-accent hover:underline inline-flex items-center"
                      >
                        View <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </RetailerLayout>
  );
};

export default RetailerInvoices;
