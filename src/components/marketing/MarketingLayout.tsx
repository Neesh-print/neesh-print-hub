import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Logo } from '@/components/neesh/Logo';
import { ButtonPrimary } from '@/components/neesh/ButtonPrimary';

interface MarketingLayoutProps {
  children: ReactNode;
}

const navLinks = [
  { label: 'Explore Magazines', href: '/explore' },
  { label: 'For Publishers', href: '/publishers' },
  { label: 'For Retailers', href: '/retailers' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'FAQ', href: '/faq' },
];

export const MarketingLayout = ({ children }: MarketingLayoutProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [email, setEmail] = useState('');
  const location = useLocation();

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement newsletter subscription
    console.log('Subscribe:', email);
    setEmail('');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Logo */}
            <Link to="/" className="flex items-center">
              <Logo size="lg" />
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className={`text-body font-medium transition-colors hover:text-accent ${
                    location.pathname === link.href ? 'text-accent' : 'text-foreground'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                to="/login"
                className="text-body font-medium text-accent hover:text-accent/80 transition-colors"
              >
                Log In
              </Link>
            </nav>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 -mr-2"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 top-16 bg-background z-40">
            <nav className="container mx-auto px-4 py-8 flex flex-col gap-6">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`text-display-sm font-medium transition-colors hover:text-accent ${
                    location.pathname === link.href ? 'text-accent' : 'text-foreground'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="text-display-sm font-medium text-accent hover:text-accent/80 transition-colors"
              >
                Log In
              </Link>
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 pt-16 md:pt-20">
        {children}
      </main>

      {/* Newsletter Section */}
      <section className="bg-secondary py-16 md:py-20">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <h3 className="text-display-sm md:text-display-md mb-3">
            Stay up to date on all things NEESH
          </h3>
          <p className="text-muted-foreground text-body-lg mb-8 max-w-md mx-auto">
            Get NEESH updates, magazine reviews, and all things indie print.
          </p>
          <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="flex-1 input-neesh"
              required
            />
            <ButtonPrimary type="submit" variant="black">
              Subscribe
            </ButtonPrimary>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-background border-t border-border py-12">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Logo */}
            <Link to="/" className="flex items-center">
              <Logo size="lg" />
            </Link>

            {/* Links */}
            <div className="flex items-center gap-6 text-body text-muted-foreground">
              <a
                href="https://instagram.com/neesh_art"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                Instagram
              </a>
              <a
                href="mailto:hi@neesh.art"
                className="hover:text-foreground transition-colors"
              >
                Contact
              </a>
              <a
                href="https://casesensitive.studio"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors flex items-center gap-1"
              >
                <span>✦✦</span> Casesensitive
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
