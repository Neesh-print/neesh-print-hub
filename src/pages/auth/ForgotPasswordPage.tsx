import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Mail, ArrowLeft } from 'lucide-react';
import { AuthLayout } from '@/components/auth';
import { FormInput } from '@/components/neesh/FormInput';
import { ButtonPrimary } from '@/components/neesh/ButtonPrimary';
import { useAuth } from '@/hooks/useAuth';

const emailSchema = z.string().email('Please enter a valid email address');

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const { resetPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      setError(emailResult.error.errors[0].message);
      return;
    }

    setIsLoading(true);

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
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <AuthLayout showBackArrow onBack={() => navigate('/login')}>
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-secondary flex items-center justify-center">
            <Mail className="w-8 h-8 text-accent" />
          </div>
          <h1 className="font-display font-bold text-display text-foreground mb-2">
            Check Your Email
          </h1>
          <p className="text-body text-text-secondary mb-2">
            We've sent a password reset link to
          </p>
          <p className="text-body font-medium text-foreground mb-6">
            {email}
          </p>
          <p className="text-caption text-text-secondary mb-8">
            Didn't receive the email? Check your spam folder or try again.
          </p>

          <div className="space-y-3">
            <ButtonPrimary 
              fullWidth 
              onClick={() => setSuccess(false)}
            >
              Send Again
            </ButtonPrimary>

            <button
              type="button"
              onClick={() => navigate('/login')}
              className="w-full flex items-center justify-center gap-2 py-3 text-body text-text-secondary hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to login
            </button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout showBackArrow onBack={() => navigate('/login')}>
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display font-bold text-display text-foreground mb-2">
          Reset Password
        </h1>
        <p className="text-body text-text-secondary">
          Enter your email and we'll send you a reset link
        </p>
      </div>

      {/* Reset Form */}
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
          Send Reset Link
        </ButtonPrimary>
      </form>

      {/* Back to login */}
      <button
        type="button"
        onClick={() => navigate('/login')}
        className="w-full flex items-center justify-center gap-2 mt-6 py-3 text-body text-text-secondary hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to login
      </button>
    </AuthLayout>
  );
};

export default ForgotPasswordPage;
