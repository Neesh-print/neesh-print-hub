import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { ButtonPrimary } from '@/components/neesh/ButtonPrimary';
import { FormInput } from '@/components/neesh/FormInput';
import { FormSelect } from '@/components/neesh/FormSelect';
import { TabNavigation } from '@/components/neesh/TabNavigation';

const emailSchema = z.string().email('Please enter a valid email address');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');

type UserRole = 'publisher' | 'retailer';

const Auth = () => {
  const navigate = useNavigate();
  const { user, isLoading, signIn, signUp, signInWithGoogle } = useAuth();
  
  const [activeTab, setActiveTab] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('retailer');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user && !isLoading) {
      navigate('/');
    }
  }, [user, isLoading, navigate]);

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

    if (activeTab === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      if (activeTab === 'login') {
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
      } else {
        const { error } = await signUp(email, password, role);
        if (error) {
          if (error.message.includes('already registered')) {
            setError('An account with this email already exists. Please sign in.');
          } else {
            setError(error.message);
          }
        } else {
          setSuccess('Account created! Please check your email to verify your account.');
          setEmail('');
          setPassword('');
          setConfirmPassword('');
        }
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError('');
    
    const { error } = await signInWithGoogle();
    
    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
    // Note: Don't set loading to false on success - user will be redirected
  };

  const tabs = [
    { id: 'login', label: 'Sign In' },
    { id: 'signup', label: 'Create Account' },
  ];

  const roleOptions = [
    { value: 'retailer', label: 'Retailer - I want to buy magazines' },
    { value: 'publisher', label: 'Publisher - I want to sell magazines' },
  ];

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
            The OS for Indie Print
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-white border border-border rounded-lg p-6 shadow-sm">
          <TabNavigation
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={(tab) => {
              setActiveTab(tab);
              setError('');
              setSuccess('');
            }}
          />

          {/* Google Sign In Button */}
          <div className="mt-6">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-border rounded-lg bg-white hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {googleLoading ? (
                <div className="w-5 h-5 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              )}
              <span className="text-body font-medium text-foreground">
                {googleLoading ? 'Signing in...' : 'Continue with Google'}
              </span>
            </button>
          </div>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-muted-foreground">Or continue with email</span>
            </div>
          </div>

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

            {activeTab === 'signup' && (
              <>
                <FormInput
                  label="Confirm Password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  required
                />

                <FormSelect
                  label="I am a..."
                  placeholder="Select your role"
                  value={role}
                  onChange={(value) => setRole(value as UserRole)}
                  options={roleOptions}
                  required
                />
              </>
            )}

            {error && (
              <div className="p-3 rounded-lg bg-status-error text-sm text-foreground">
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 rounded-lg bg-status-success text-sm text-foreground">
                {success}
              </div>
            )}

            <ButtonPrimary
              type="submit"
              fullWidth
              loading={submitting}
              disabled={submitting || googleLoading}
              variant="black"
            >
              {activeTab === 'login' ? 'Sign In' : 'Create Account'}
            </ButtonPrimary>
          </form>

          {activeTab === 'login' && (
            <p className="mt-4 text-center text-sm text-text-secondary">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => setActiveTab('signup')}
                className="text-accent-purple hover:underline font-medium"
              >
                Sign up
              </button>
            </p>
          )}

          {activeTab === 'signup' && (
            <p className="mt-4 text-center text-sm text-text-secondary">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setActiveTab('login')}
                className="text-accent-purple hover:underline font-medium"
              >
                Sign in
              </button>
            </p>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-text-secondary">
          By continuing, you agree to Neesh's Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
};

export default Auth;
