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

      // TODO: Trigger shipping notification email via edge function

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
