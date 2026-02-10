import { useState } from "react";
import { z } from "zod";
import { Check } from "lucide-react";
import { Modal, FormInput, ButtonPrimary, ButtonSecondary } from "@/components/neesh";
import { useAuth } from "@/hooks/useAuth";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangePasswordModal = ({ isOpen, onClose }: ChangePasswordModalProps) => {
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const passwordChecks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const result = passwordSchema.safeParse(password);
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await updatePassword(password);
      if (error) {
        setError(error.message);
      } else {
        setSuccess(true);
        setTimeout(() => {
          handleClose();
        }, 2000);
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setPassword("");
    setConfirmPassword("");
    setError("");
    setSuccess(false);
    onClose();
  };

  if (success) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} title="Password Updated">
        <div className="text-center py-4">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
            <Check className="w-6 h-6 text-green-600" />
          </div>
          <p className="text-body text-foreground">
            Your password has been updated successfully.
          </p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Change Password"
      footer={
        <>
          <ButtonSecondary onClick={handleClose} disabled={isLoading}>
            Cancel
          </ButtonSecondary>
          <ButtonPrimary onClick={handleSubmit} loading={isLoading} disabled={isLoading}>
            Update Password
          </ButtonPrimary>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Set a new password for your account. You can use this to sign in instead of magic links.
        </p>

        <FormInput
          label="New Password"
          type="password"
          placeholder="Enter new password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          required
        />

        {password.length > 0 && (
          <div className="space-y-2 p-3 rounded-lg bg-secondary">
            <p className="text-xs font-medium text-foreground mb-2">
              Password requirements:
            </p>
            <div className="grid grid-cols-2 gap-2">
              <PasswordCheck label="8+ characters" met={passwordChecks.length} />
              <PasswordCheck label="Uppercase letter" met={passwordChecks.uppercase} />
              <PasswordCheck label="Lowercase letter" met={passwordChecks.lowercase} />
              <PasswordCheck label="Number" met={passwordChecks.number} />
            </div>
          </div>
        )}

        <FormInput
          label="Confirm Password"
          type="password"
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
          required
        />

        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 text-sm text-destructive">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
};

const PasswordCheck = ({ label, met }: { label: string; met: boolean }) => (
  <div className="flex items-center gap-2">
    <div
      className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${
        met ? "bg-green-500" : "bg-border"
      }`}
    >
      {met && <Check className="w-2.5 h-2.5 text-white" />}
    </div>
    <span className={`text-xs ${met ? "text-foreground" : "text-muted-foreground"}`}>
      {label}
    </span>
  </div>
);
