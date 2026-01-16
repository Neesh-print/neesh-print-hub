import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { ArrowLeft, Mail } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { ButtonPrimary } from '@/components/neesh/ButtonPrimary';
import { FormInput } from '@/components/neesh/FormInput';

const emailSchema = z.string().email('Please enter a valid email address');

const ForgotPassword = () => {
  const navigate = useNavigate();
  const { resetPassword } = useAuth();
  
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate email
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      setError(emailResult.error.errors[0].message);
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await resetPassword(email);
      
      if (error) {
        setError(error.message);
      } else {
        setSuccess(true);
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

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
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center">
                <Mail className="w-8 h-8 text-accent" />
              </div>
              <h2 className="font-display font-semibold text-xl text-foreground mb-2">
                Check Your Email
              </h2>
              <p className="text-body text-muted-foreground mb-4">
                We've sent a password reset link to <span className="font-medium text-foreground">{email}</span>
              </p>
              <p className="text-caption text-muted-foreground mb-6">
                Didn't receive the email? Check your spam folder or try again.
              </p>
              <div className="space-y-3">
                <ButtonPrimary onClick={() => setSuccess(false)} fullWidth variant="black">
                  Send Again
                </ButtonPrimary>
                <button
                  type="button"
                  onClick={() => navigate('/auth')}
                  className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Back to Sign In
                </button>
              </div>
            </div>
          ) : (
            <>
              <h2 className="font-display font-semibold text-xl text-foreground mb-2">
                Forgot Password?
              </h2>
              <p className="text-body text-muted-foreground mb-6">
                Enter your email address and we'll send you a link to reset your password.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <FormInput
                  label="Email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={setEmail}
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
                  Send Reset Link
                </ButtonPrimary>
              </form>
            </>
          )}
        </div>

        {/* Back to login */}
        {!success && (
          <button
            type="button"
            onClick={() => navigate('/auth')}
            className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mx-auto"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Sign In
          </button>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
