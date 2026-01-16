import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { ArrowLeft, Check } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { ButtonPrimary } from '@/components/neesh/ButtonPrimary';
import { FormInput } from '@/components/neesh/FormInput';

const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');

const ResetPassword = () => {
  const navigate = useNavigate();
  const { session, isLoading, updatePassword } = useAuth();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Check if user has a valid recovery session
  useEffect(() => {
    // If no session after loading completes, redirect to auth
    if (!isLoading && !session) {
      // Give a small delay to allow session to be established from URL hash
      const timer = setTimeout(() => {
        if (!session) {
          navigate('/auth');
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [session, isLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate password
    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      setError(passwordResult.error.errors[0].message);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await updatePassword(password);
      
      if (error) {
        setError(error.message);
      } else {
        setSuccess(true);
        // Redirect to home after 3 seconds
        setTimeout(() => {
          navigate('/');
        }, 3000);
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="font-display font-bold text-3xl tracking-tight text-foreground">
            NEESH
          </h1>
          <p className="text-text-secondary mt-2">
            Reset Your Password
          </p>
        </div>

        {/* Reset Card */}
        <div className="bg-white border border-border rounded-lg p-6 shadow-sm">
          {success ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-status-success flex items-center justify-center">
                <Check className="w-8 h-8 text-chart-green" />
              </div>
              <h2 className="font-display font-semibold text-xl text-foreground mb-2">
                Password Updated!
              </h2>
              <p className="text-body text-muted-foreground mb-4">
                Your password has been successfully changed. Redirecting you to the dashboard...
              </p>
              <ButtonPrimary onClick={() => navigate('/')} fullWidth>
                Go to Dashboard
              </ButtonPrimary>
            </div>
          ) : (
            <>
              <h2 className="font-display font-semibold text-xl text-foreground mb-2">
                Create New Password
              </h2>
              <p className="text-body text-muted-foreground mb-6">
                Enter your new password below.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <FormInput
                  label="New Password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={setPassword}
                  required
                  helperText="Must be at least 6 characters"
                />

                <FormInput
                  label="Confirm New Password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  required
                />

                {error && (
                  <div className="p-3 rounded-lg bg-status-error text-sm text-foreground">
                    {error}
                  </div>
                )}

                <ButtonPrimary
                  type="submit"
                  fullWidth
                  loading={submitting}
                  disabled={submitting}
                  variant="black"
                >
                  Update Password
                </ButtonPrimary>
              </form>
            </>
          )}
        </div>

        {/* Back to login */}
        <button
          type="button"
          onClick={() => navigate('/auth')}
          className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mx-auto"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Sign In
        </button>
      </div>
    </div>
  );
};

export default ResetPassword;
