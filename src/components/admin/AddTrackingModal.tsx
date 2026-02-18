import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FormInput, FormSelect, ButtonPrimary, ButtonSecondary } from "@/components/neesh";
import { detectCarrier } from "@/components/retailer/OrderStatusTimeline";

export interface AddTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (trackingData: { carrier: string; trackingNumber: string }) => void;
  orderNumber: string;
  isLoading: boolean;
}

const carrierOptions = [
  { value: 'usps', label: 'USPS' },
  { value: 'ups', label: 'UPS' },
  { value: 'fedex', label: 'FedEx' },
  { value: 'dhl', label: 'DHL' },
  { value: 'amazon', label: 'Amazon Logistics' },
  { value: 'other', label: 'Other' },
];

export const AddTrackingModal = ({
  isOpen,
  onClose,
  onSubmit,
  orderNumber,
  isLoading,
}: AddTrackingModalProps) => {
  const [carrier, setCarrier] = useState('usps');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [manualCarrierOverride, setManualCarrierOverride] = useState(false);

  // Auto-detect carrier from tracking number
  useEffect(() => {
    if (manualCarrierOverride) return;
    const detected = detectCarrier(trackingNumber);
    if (detected) {
      setCarrier(detected);
    }
  }, [trackingNumber, manualCarrierOverride]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (trackingNumber.trim()) {
      onSubmit({ carrier, trackingNumber: trackingNumber.trim() });
    }
  };

  const handleCarrierChange = (value: string) => {
    setCarrier(value);
    setManualCarrierOverride(true);
  };

  const handleClose = () => {
    setCarrier('usps');
    setTrackingNumber('');
    setManualCarrierOverride(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Tracking - Order #{orderNumber}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormSelect
            label="Carrier"
            value={carrier}
            onChange={handleCarrierChange}
            options={carrierOptions}
          />
          
          <FormInput
            label="Tracking Number"
            value={trackingNumber}
            onChange={setTrackingNumber}
            placeholder="Enter tracking number"
            required
          />
          
          <p className="text-sm text-muted-foreground">
            The retailer will be notified with tracking information.
          </p>
          
          <DialogFooter className="gap-2 sm:gap-0">
            <ButtonSecondary type="button" onClick={handleClose}>
              Cancel
            </ButtonSecondary>
            <ButtonPrimary
              type="submit"
              loading={isLoading}
              disabled={!trackingNumber.trim()}
            >
              Mark as Shipped
            </ButtonPrimary>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
