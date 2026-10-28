import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PACKED_STATUS } from "@/lib/orderStatus";

export interface UseUpdateOrderStatusReturn {
  updateStatus: (orderId: string, status: string) => Promise<boolean>;
  addTracking: (orderId: string, carrier: string, trackingNumber: string) => Promise<boolean>;
  isUpdating: boolean;
  error: string | null;
}

export const useUpdateOrderStatus = (): UseUpdateOrderStatusReturn => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateStatus = async (orderId: string, status: string): Promise<boolean> => {
    setIsUpdating(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('orders')
        .update({ 
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      if (updateError) throw updateError;
      return true;

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update order');
      return false;
    } finally {
      setIsUpdating(false);
    }
  };

  const addTracking = async (orderId: string, carrier: string, trackingNumber: string): Promise<boolean> => {
    setIsUpdating(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          tracking_number: trackingNumber,
          carrier: carrier, // Save to proper carrier column
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      if (updateError) throw updateError;

      // Tracking means Packed (stored as processing). The first carrier scan
      // moves it to shipped through shippo-webhook. Only a paid order moves,
      // so editing tracking on a shipped order never sends it backwards.
      const { error: statusError } = await supabase
        .from('orders')
        .update({ status: PACKED_STATUS })
        .eq('id', orderId)
        .eq('status', 'paid');

      if (statusError) throw statusError;

      // Ask Shippo to follow the tracking number so carrier scans reach us.
      // Non-fatal: without it the order waits in Packed and shows on Today.
      supabase.functions
        .invoke('register-tracking', { body: { orderId } })
        .then(({ error: registerError }) => {
          if (registerError) console.error('Failed to register tracking:', registerError);
        });

      // Send automated message with tracking info
      try {
        // Get retailer_id and current user (sender)
        const { data: { user } } = await supabase.auth.getUser();
        
        // Fetch order to get retailer_id
        const { data: orderData } = await supabase
          .from('orders')
          .select('retailer_id, magazine_id, magazines(title)')
          .eq('id', orderId)
          .single();

        if (user && orderData?.retailer_id) {
          const magazineTitle = orderData.magazines?.title || 'your order';
          const trackingLink = carrier.toLowerCase() === 'usps' 
            ? `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`
            : carrier.toLowerCase() === 'ups'
            ? `https://www.ups.com/track?tracknum=${trackingNumber}`
            : carrier.toLowerCase() === 'fedex'
            ? `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`
            : `Tracking: ${trackingNumber}`;

          const messageContent = `Your order for "${magazineTitle}" is packed and has tracking.
Carrier: ${carrier.toUpperCase()}
Tracking Number: ${trackingNumber}

You can track your package here: ${trackingLink}`;

          await supabase.from('notifications').insert({
              user_id: orderData.retailer_id, // Recipient: Retailer
              title: 'Order Packed',
              content: messageContent,
              notification_type: 'order_update',
              related_order_id: orderId,
          });
        }
      } catch (msgError) {
          console.error("Failed to send tracking message:", msgError);
          // Non-fatal, don't fail the tracking update
      }

      return true;

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add tracking');
      return false;
    } finally {
      setIsUpdating(false);
    }
  };

  return { updateStatus, addTracking, isUpdating, error };
};
