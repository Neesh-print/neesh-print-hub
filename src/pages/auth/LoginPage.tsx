import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { AuthLayout, AuthDivider, AuthLink } from '@/components/auth';
import { FormInput } from '@/components/neesh/FormInput';
import { ButtonPrimary } from '@/components/neesh/ButtonPrimary';
import { useAuth } from '@/hooks/useAuth';

const emailSchema = z.string().email('Please enter a valid email address');
const passwordSchema = z.string().min(1, 'Password is required');

const LoginPage = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, isRoleLoading, userRole, signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
  }, [user, authLoading, isRoleLoading, userRole, navigate]);

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

  return (
    <AuthLayout showBackArrow onBack={() => navigate('/')}>
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display font-bold text-display text-foreground mb-2">
          Welcome Back
        </h1>
        <p className="text-body text-text-secondary">
          Log in to your account
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
          Log In
        </ButtonPrimary>
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
