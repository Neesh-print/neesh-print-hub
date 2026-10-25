import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Modal, FormInput, ButtonSecondary } from "@/components/neesh";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface DeleteAccountSectionProps {
  /** What stays after closing, e.g. "Your order history" */
  keeps: string;
}

const CONFIRM_WORD = "DELETE";

/**
 * Danger-zone block for the settings pages. Calls the delete-user-data edge
 * function, which refuses (409) while orders are open, invoices unpaid or
 * payouts pending, and otherwise removes personal details and the login.
 */
export const DeleteAccountSection = ({ keeps }: DeleteAccountSectionProps) => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const close = () => {
    if (isDeleting) return;
    setIsOpen(false);
    setConfirmText("");
    setError("");
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setError("");
    const { error: invokeError } = await supabase.functions.invoke("delete-user-data", { body: {} });
    if (invokeError) {
      let message = "We couldn't delete your account. Please try again or contact support.";
      if ("context" in invokeError && invokeError.context instanceof Response) {
        try {
          const body = await invokeError.context.json();
          if (body?.error) message = body.error;
        } catch {
          // keep the generic message
        }
      }
      setError(message);
      setIsDeleting(false);
      return;
    }
    await signOut();
    navigate("/", { replace: true });
  };

  return (
    <div>
      <h4 className="font-medium text-destructive mb-1">Delete Account</h4>
      <p className="text-sm text-muted-foreground mb-3">
        This removes your login and personal details. {keeps} is kept for our tax and payout records, without your
        contact details.
      </p>
      <ButtonSecondary destructive onClick={() => setIsOpen(true)}>
        Delete Account
      </ButtonSecondary>

      <Modal
        isOpen={isOpen}
        onClose={close}
        title="Delete your account?"
        size="sm"
        preventClose={isDeleting}
        footer={
          <div className="flex justify-end gap-3">
            <ButtonSecondary onClick={close} disabled={isDeleting}>
              Cancel
            </ButtonSecondary>
            <ButtonSecondary
              destructive
              onClick={handleDelete}
              loading={isDeleting}
              disabled={confirmText.trim() !== CONFIRM_WORD}
            >
              Delete Account
            </ButtonSecondary>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This can't be undone. You'll be signed out and won't be able to sign in again with this email.
          </p>
          <FormInput
            label={`Type ${CONFIRM_WORD} to confirm`}
            value={confirmText}
            onChange={setConfirmText}
            disabled={isDeleting}
            autoComplete="off"
          />
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
};
