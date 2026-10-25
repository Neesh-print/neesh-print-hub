import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { Check } from 'lucide-react';
import { AuthLayout } from '@/components/auth';
import { FormInput } from '@/components/neesh/FormInput';
import { ButtonPrimary } from '@/components/neesh/ButtonPrimary';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { getLinkError } from '@/lib/auth-link';

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session, user, isLoading: authLoading, updatePassword, userRole } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // Starts true when there is a token to verify, so the expired-link state
  // does not flash before verification begins.
  const [isVerifying, setIsVerifying] = useState(
    () => Boolean(searchParams.get('token_hash')) && searchParams.get('type') === 'recovery'
  );
  const [linkInvalid, setLinkInvalid] = useState(
    () => getLinkError(window.location.search, window.location.hash) !== null
  );

  const getDashboardPath = () => {
    switch (userRole) {
      case 'publisher': return '/publisher';
      case 'retailer': return '/retailer';
      case 'admin': return '/admin';
      default: return '/';
    }
  };

  // Password strength indicators
  const passwordChecks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
  };

  // Handle token_hash query param (from approval emails sent via Resend).
  // The link goes to our app instead of Supabase's /auth/v1/verify endpoint
  // so that email client link scanners don't consume the single-use token.
  useEffect(() => {
    const tokenHash = searchParams.get('token_hash');
    const type = searchParams.get('type');

    if (tokenHash && type === 'recovery') {
      setIsVerifying(true);
      supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'recovery',
      }).then(({ data, error: verifyError }) => {
        if (verifyError || !data.session) {
          if (verifyError) console.error('OTP verification failed:', verifyError);
          setLinkInvalid(true);
          setIsVerifying(false);
        }
        // On success, stay in the loading state until useAuth picks up the
        // new session (see the loading check), so the expired-link state never flashes.
      });
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      setError(passwordResult.error.errors[0].message);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await updatePassword(password);

      if (error) {
        setError(error.message);
      } else {
        // Mark password as set in profile (matches ChangePasswordModal behavior)
        if (user) {
          await supabase
            .from('profiles')
            .update({ has_set_password: true })
            .eq('user_id', user.id);
        }

        setSuccess(true);
        setTimeout(() => {
          navigate(getDashboardPath());
        }, 3000);
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || (isVerifying && !session && !linkInvalid)) {
    return (
      <AuthLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-pulse text-foreground">Loading...</div>
        </div>
      </AuthLayout>
    );
  }

  if (success) {
    return (
      <AuthLayout>
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-status-success flex items-center justify-center">
            <Check className="w-8 h-8 text-chart-green" />
          </div>
          <h1 className="font-display font-bold text-display text-foreground mb-2">
            Password Updated!
          </h1>
          <p className="text-body text-text-secondary mb-6">
            Your password has been successfully changed. Redirecting you to the dashboard...
          </p>
          <ButtonPrimary fullWidth onClick={() => navigate(getDashboardPath())}>
            Go to Dashboard
          </ButtonPrimary>
        </div>
      </AuthLayout>
    );
  }

  // A used or expired link, or no recovery session at all (opened directly,
  // or the link was consumed by an email scanner): say so instead of showing
  // a form that cannot be submitted.
  if (linkInvalid || !session) {
    return (
      <AuthLayout>
        <div className="text-center py-8">
          <h1 className="font-display font-bold text-display text-foreground mb-2">
            This link has expired
          </h1>
          <p className="text-body text-text-secondary mb-6">
            Password reset links work once and expire after a short time. Request a new one and use the
            latest email we send you.
          </p>
          <ButtonPrimary fullWidth onClick={() => navigate('/forgot-password')}>
            Send a new link
          </ButtonPrimary>
          <p className="text-caption text-text-secondary mt-4">
            <Link to="/login" className="underline">Back to sign in</Link>
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display font-bold text-display text-foreground mb-2">
          Create New Password
        </h1>
        <p className="text-body text-text-secondary">
          Enter your new password below
        </p>
      </div>

      {/* Reset Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormInput
          label="New Password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={setPassword}
          required
        />

        {/* Password strength indicators */}
        {password.length > 0 && (
          <div className="space-y-2 p-3 rounded-lg bg-secondary">
            <p className="text-caption font-medium text-foreground mb-2">
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
          label="Confirm New Password"
          type="password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={setConfirmPassword}
          required
        />

        {error && (
          <div className="p-3 rounded-lg bg-status-error text-caption text-foreground">
            {error}
          </div>
        )}

        <ButtonPrimary
          type="submit"
          fullWidth
          loading={isLoading}
          disabled={isLoading || !session}
        >
          Reset Password
        </ButtonPrimary>
      </form>
    </AuthLayout>
  );
};

// Helper component for password checks
const PasswordCheck = ({ label, met }: { label: string; met: boolean }) => (
  <div className="flex items-center gap-2">
    <div
      className={`w-4 h-4 rounded-full flex items-center justify-center ${
        met ? 'bg-chart-green' : 'bg-border'
      }`}
    >
      {met && <Check className="w-3 h-3 text-white" />}
    </div>
    <span className={`text-caption ${met ? 'text-foreground' : 'text-text-secondary'}`}>
      {label}
    </span>
  </div>
);

export default ResetPasswordPage;
