import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { ButtonPrimary, ButtonSecondary } from "@/components/neesh";

export interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: 'primary' | 'destructive';
  isLoading?: boolean;
}

export const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  confirmVariant = 'primary',
  isLoading = false,
}: ConfirmationModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <ButtonSecondary onClick={onClose} disabled={isLoading}>
            Cancel
          </ButtonSecondary>
          {confirmVariant === 'destructive' ? (
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className="btn-neesh-secondary text-status-error-text hover:bg-status-error/10 disabled:opacity-50"
            >
              {isLoading ? 'Processing...' : confirmLabel}
            </button>
          ) : (
            <ButtonPrimary onClick={onConfirm} disabled={isLoading}>
              {isLoading ? 'Processing...' : confirmLabel}
            </ButtonPrimary>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
