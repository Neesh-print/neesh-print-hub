import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useStockNotification(magazineId: string) {
  const { user } = useAuth();
  const [isNotifyRequested, setIsNotifyRequested] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [retailerId, setRetailerId] = useState<string | null>(null);

  // Get retailer ID for current user
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('retailers')
      .select('id')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (data) setRetailerId(data.id);
      });
  }, [user?.id]);

  // Check if already requested
  useEffect(() => {
    if (!retailerId || !magazineId) return;
    supabase
      .from('stock_notifications')
      .select('id')
      .eq('retailer_id', retailerId)
      .eq('magazine_id', magazineId)
      .maybeSingle()
      .then(({ data }) => {
        setIsNotifyRequested(!!data);
      });
  }, [retailerId, magazineId]);

  const toggleNotification = useCallback(async () => {
    if (!retailerId || !magazineId) return;
    setIsLoading(true);

    try {
      if (isNotifyRequested) {
        await supabase
          .from('stock_notifications')
          .delete()
          .eq('retailer_id', retailerId)
          .eq('magazine_id', magazineId);
        setIsNotifyRequested(false);
      } else {
        await supabase
          .from('stock_notifications')
          .insert({ retailer_id: retailerId, magazine_id: magazineId });
        setIsNotifyRequested(true);
      }
    } catch (err) {
      console.error('Error toggling stock notification:', err);
    } finally {
      setIsLoading(false);
    }
  }, [retailerId, magazineId, isNotifyRequested]);

  return { isNotifyRequested, toggleNotification, isLoading };
}
