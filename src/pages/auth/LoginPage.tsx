import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { z } from 'zod';
import { AuthLayout, AuthDivider, AuthLink } from '@/components/auth';
import { FormInput } from '@/components/neesh/FormInput';
import { ButtonPrimary } from '@/components/neesh/ButtonPrimary';
import { useAuth } from '@/hooks/useAuth';

const emailSchema = z.string().email('Please enter a valid email address');
const passwordSchema = z.string().min(1, 'Password is required');

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading: authLoading, isRoleLoading, userRole, signIn, signInWithEmailLink } = useAuth();

  // ProtectedRoute sends the intended destination along when it bounces an
  // unauthenticated visitor here. Emailed links (e.g. the payout nudge landing
  // on /onboarding/continue) depend on it: without this, signing in would drop
  // the publisher on their dashboard and quietly lose the flow.
  const redirectTo = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from;
  const redirectPath = redirectTo?.pathname
    ? `${redirectTo.pathname}${redirectTo.search ?? ''}`
    : null;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // "Email me a sign-in link": works for any existing account, no password.
  const [isSendingLink, setIsSendingLink] = useState(false);
  const [linkSentTo, setLinkSentTo] = useState<string | null>(null);

  // Redirect if already logged in AND role is loaded
  useEffect(() => {
    // Must wait for both auth AND role loading to complete
    if (user && !authLoading && !isRoleLoading) {
      // Debug logging
      console.log('LoginPage redirect check:', {
        user: !!user,
        authLoading,
        isRoleLoading,
        userRole,
      });
      
      // Honour an intended destination first; fall back to the role dashboard.
      if (redirectPath) {
        navigate(redirectPath, { replace: true });
        return;
      }

      // Role-based redirect
      switch (userRole) {
        case 'publisher':
          navigate('/publisher');
          break;
        case 'retailer':
          navigate('/retailer');
          break;
        case 'admin':
          navigate('/admin');
          break;
        default:
          // User exists but no valid role - redirect to pending
          navigate('/pending');
      }
    }
  }, [user, authLoading, isRoleLoading, userRole, navigate, redirectPath]);

  const validateForm = () => {
    setError('');

    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      setError(emailResult.error.errors[0].message);
      return false;
    }

    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      setError(passwordResult.error.errors[0].message);
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);
    setError('');

    try {
      const { error } = await signIn(email, password);
      
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setError('Invalid email or password. Please try again.');
        } else if (error.message.includes('Email not confirmed')) {
          setError('Please verify your email before signing in.');
        } else {
          setError(error.message);
        }
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailLink = async () => {
    setError('');
    const emailResult = emailSchema.safeParse(email.trim());
    if (!emailResult.success) {
      setError('Enter your email above and we will send you a sign-in link.');
      return;
    }
    setIsSendingLink(true);
    try {
      // The result is deliberately not shown: an email with no account gets
      // exactly the same screen, so this can't be used to find out who has one.
      const { error: linkError } = await signInWithEmailLink(email.trim(), redirectPath);
      if (linkError) console.warn('Sign-in link not sent:', linkError.message);
    } catch (err) {
      console.warn('Sign-in link not sent:', err);
    } finally {
      setIsSendingLink(false);
      setLinkSentTo(email.trim());
    }
  };

  if (linkSentTo) {
    return (
      <AuthLayout showBackArrow onBack={() => setLinkSentTo(null)}>
        <div className="mb-8">
          <h1 className="font-display font-bold text-display text-foreground mb-2">
            Check your email
          </h1>
          <p className="text-body text-text-secondary">
            If there&rsquo;s a Neesh account for <span className="text-foreground">{linkSentTo}</span>,
            we&rsquo;ve sent a sign-in link. It works once, for an hour.
          </p>
        </div>
        <p className="text-caption text-text-secondary">
          Nothing arrived? Check your spam folder, or{' '}
          <button
            type="button"
            onClick={() => setLinkSentTo(null)}
            className="underline underline-offset-2 hover:text-foreground"
          >
            try again
          </button>
          .
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout showBackArrow onBack={() => navigate('/')}>
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display font-bold text-display text-foreground mb-2">
          Welcome back
        </h1>
        <p className="text-body text-text-secondary">
          Log in to your account.
        </p>
      </div>

      {/* Login Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormInput
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={setEmail}
          required
        />

        <FormInput
          label="Password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={setPassword}
          required
        />

        <div className="text-right">
          <button
            type="button"
            onClick={() => navigate('/forgot-password')}
            className="text-caption text-text-secondary hover:text-foreground transition-colors"
          >
            Forgot password?
          </button>
        </div>

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
          Log in
        </ButtonPrimary>

        <button
          type="button"
          onClick={handleEmailLink}
          disabled={isSendingLink}
          className="w-full h-12 rounded-lg border border-border text-body font-medium text-foreground hover:bg-secondary transition-colors disabled:opacity-60"
        >
          {isSendingLink ? 'Sending...' : 'Email me a sign-in link'}
        </button>
        <p className="text-caption text-text-secondary text-center">
          No password needed. We&rsquo;ll email you a link that signs you in.
        </p>
      </form>

      {/* Divider */}
      <AuthDivider />

      {/* Apply link */}
      <AuthLink
        text="New to Neesh?"
        actionText="Apply"
        to="/apply"
      />

      {/* Divider */}
      <AuthDivider />

      {/* Talk to team link */}
      <AuthLink
        text="Have any questions?"
        actionText="Talk to the team"
        onClick={() => window.open('mailto:hi@neesh.art', '_blank')}
      />
    </AuthLayout>
  );
};

export default LoginPage;
