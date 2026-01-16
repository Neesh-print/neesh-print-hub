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
  const { user, isLoading, signIn, signUp } = useAuth();
  
  const [activeTab, setActiveTab] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('retailer');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
              disabled={submitting}
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
