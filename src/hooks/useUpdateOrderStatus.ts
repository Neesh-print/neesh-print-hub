import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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
          status: 'shipped',
          tracking_number: trackingNumber,
          carrier: carrier, // Save to proper carrier column
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      if (updateError) throw updateError;

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

          const messageContent = `Your order for "${magazineTitle}" has shipped! 
Carrier: ${carrier.toUpperCase()}
Tracking Number: ${trackingNumber}

You can track your package here: ${trackingLink}`;

          await supabase.from('notifications').insert({
              user_id: orderData.retailer_id, // Recipient: Retailer
              title: 'Order Shipped',
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
