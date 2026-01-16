import { Modal } from "@/components/neesh/Modal";
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="flex gap-3 justify-end">
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
        </div>
      }
    >
      <p className="text-body text-foreground">{message}</p>
    </Modal>
  );
};
