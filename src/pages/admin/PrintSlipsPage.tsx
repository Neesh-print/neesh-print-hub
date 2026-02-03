import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Printer, ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { PackingSlip, packingSlipPrintStyles } from "@/components/admin/PackingSlip";
import { ButtonPrimary, ButtonSecondary } from "@/components/neesh";
import { supabase } from "@/integrations/supabase/client";
import type { PackingSlipOrder } from "@/components/admin/PackingSlip";

export const PrintSlipsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [orders, setOrders] = useState<PackingSlipOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Parse order IDs from query params
  const orderIds = useMemo(() => {
    const ordersParam = searchParams.get("orders");
    if (!ordersParam) return [];
    return ordersParam.split(",").filter(Boolean);
  }, [searchParams]);

  const fetchOrders = useCallback(async () => {
    if (orderIds.length === 0) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('orders')
        .select(`
          id,
          quantity,
          created_at,
          shipping_address,
          retailers (
            shop_name,
            address,
            city,
            state,
            postal_code,
            country
          ),
          magazines (
            title,
            publishers (
              company_name
            )
          )
        `)
        .in('id', orderIds);

      if (fetchError) throw fetchError;

      type RawOrderRow = {
        id: string;
        created_at: string;
        quantity: number;
        shipping_address: string | null;
        retailers: {
          shop_name: string | null;
          address: string | null;
          city: string | null;
          state: string | null;
          postal_code: string | null;
          country: string | null;
        } | null;
        magazines: {
          title: string;
          publishers: {
            company_name: string | null;
          } | null;
        } | null;
      };

      const transformed: PackingSlipOrder[] = (data || []).map((order) => {
        const orderData = order as unknown as RawOrderRow;
        // Parse shipping address: try to use structured retailer data if no shipping_address
        let shippingAddress = {
          street: '',
          city: '',
          state: '',
          zip: '',
        };

        if (order.shipping_address) {
          // If shipping_address is a single string, split by newlines/commas
          const parts = order.shipping_address.split(/[,\n]+/).map((s: string) => s.trim());
          shippingAddress = {
            street: parts[0] || '',
            city: parts[1] || '',
            state: parts[2] || '',
            zip: parts[3] || '',
          };
        } else if (order.retailers) {
          shippingAddress = {
            street: order.retailers.address || '',
            city: order.retailers.city || '',
            state: order.retailers.state || '',
            zip: order.retailers.postal_code || '',
          };
        }

        return {
          orderNumber: order.id.slice(0, 8).toUpperCase(),
          createdAt: order.created_at || new Date().toISOString(),
          retailerName: order.retailers?.shop_name || 'Unknown Retailer',
          shippingAddress,
          items: [{
            title: order.magazines?.title || 'Unknown Magazine',
            publisher: order.magazines?.publishers?.company_name || 'Unknown Publisher',
            quantity: order.quantity || 1,
          }],
        };
      });

      setOrders(transformed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch orders');
    } finally {
      setIsLoading(false);
    }
  }, [orderIds]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Inject print styles on mount
  useEffect(() => {
    const styleElement = document.createElement("style");
    styleElement.id = "packing-slip-print-styles";
    styleElement.textContent = packingSlipPrintStyles;
    document.head.appendChild(styleElement);

    return () => {
      const existingStyle = document.getElementById("packing-slip-print-styles");
      if (existingStyle) {
        existingStyle.remove();
      }
    };
  }, []);

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-muted-foreground" />
          <p className="text-body text-muted-foreground">Loading packing slips...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-status-error-text mx-auto mb-3" />
          <h3 className="font-display font-semibold text-heading text-foreground mb-1">Failed to load orders</h3>
          <p className="text-body text-muted-foreground mb-4">{error}</p>
          <ButtonSecondary onClick={() => navigate("/admin/fulfillment")}>Back to Fulfillment</ButtonSecondary>
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Printer className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
          <h3 className="font-display font-semibold text-heading text-foreground mb-1">No orders found to print</h3>
          <p className="text-body text-muted-foreground mb-4">The requested orders could not be found.</p>
          <ButtonSecondary onClick={() => navigate("/admin/fulfillment")}>
            Back to Fulfillment
          </ButtonSecondary>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header - hidden when printing */}
      <div className="no-print sticky top-0 bg-background border-b border-border z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <ButtonSecondary
            onClick={() => navigate("/admin/fulfillment")}
            icon={<ArrowLeft className="w-4 h-4" />}
          >
            Back to Fulfillment
          </ButtonSecondary>
          <ButtonPrimary
            onClick={handlePrint}
            icon={<Printer className="w-4 h-4" />}
          >
            Print All Slips ({orders.length})
          </ButtonPrimary>
        </div>
      </div>

      {/* Packing Slips */}
      <div className="print-container py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {orders.map((order) => (
            <div key={order.orderNumber} className="shadow-lg no-print:shadow-lg">
              <PackingSlip order={order} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PrintSlipsPage;
