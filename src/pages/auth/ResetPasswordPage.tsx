import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Check } from 'lucide-react';
import { AuthLayout } from '@/components/auth';
import { FormInput } from '@/components/neesh/FormInput';
import { ButtonPrimary } from '@/components/neesh/ButtonPrimary';
import { useAuth } from '@/hooks/useAuth';

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const { session, isLoading: authLoading, updatePassword, userRole } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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

  // Redirect if no session (user didn't come from email link)
  useEffect(() => {
    if (!authLoading && !session) {
      const timer = setTimeout(() => {
        if (!session) {
          navigate('/login');
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [session, authLoading, navigate]);

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

  if (authLoading) {
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
          disabled={isLoading}
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
