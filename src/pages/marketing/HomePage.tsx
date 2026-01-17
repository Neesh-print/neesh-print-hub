import { Link } from 'react-router-dom';
import { FileText, Store, Search, Send, LayoutDashboard, CheckCircle } from 'lucide-react';
import { MarketingLayout } from '@/components/marketing/MarketingLayout';
import { ButtonPrimary } from '@/components/neesh/ButtonPrimary';
import heroFlatlay from '@/assets/hero-magazine-flatlay.jpg';
import ctaFlowers from '@/assets/cta-flowers.jpg';
import ctaCouch from '@/assets/cta-couch.jpg';

export const HomePage = () => {
  return (
    <MarketingLayout>
      {/* Hero Section */}
      <section className="py-16 md:py-24 lg:py-32">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Text Content */}
            <div className="order-2 lg:order-1">
              <h1 className="text-display-lg md:text-[3.5rem] lg:text-[4rem] leading-[1.05] font-display font-bold mb-6">
                The Marketplace for Independent Magazines.
              </h1>
              <p className="text-body-lg md:text-xl text-muted-foreground mb-8 max-w-lg">
                Publishers get discovered and paid faster. Retailers stock rare titles with zero risk.
              </p>
              <Link to="/explore">
                <ButtonPrimary variant="black" className="text-base px-8 py-3">
                  Explore Magazines
                </ButtonPrimary>
              </Link>
            </div>

            {/* Hero Image */}
            <div className="order-1 lg:order-2">
              <div className="relative">
                <div className="aspect-[4/3] rounded-lg overflow-hidden bg-secondary">
                  <img
                    src={heroFlatlay}
                    alt="A colorful flatlay of independent magazines including Precog, Subway, and other titles"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Dual Value Prop Section */}
      <section className="bg-accent/10 py-16 md:py-24">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid md:grid-cols-2 gap-12 lg:gap-16">
            {/* For Publishers */}
            <div>
              <span className="inline-block text-caption uppercase tracking-widest text-muted-foreground mb-4">
                For Publishers
              </span>
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-6 h-6 text-accent" />
                </div>
                <h2 className="text-display-sm md:text-display-md font-display font-bold">
                  Get stocked. Get paid. Stay independent.
                </h2>
              </div>
              <div className="text-body-lg text-muted-foreground space-y-4 mb-6">
                <p>
                  The hardest shelves to reach are often the most valuable. Neesh opens access to retailers that traditional distributors overlook and makes every transaction clean and direct.
                </p>
                <p>
                  List your catalog once and get discovered by design-forward retailers nationwide. You ship directly to them, maintaining relationships and control over your inventory. We negotiate shipping rates you couldn't get alone and give you one dashboard to manage everything.
                </p>
              </div>
              <Link
                to="/publishers"
                className="inline-flex items-center text-body font-medium text-foreground hover:text-accent transition-colors"
              >
                For Publishers →
              </Link>
            </div>

            {/* For Retailers */}
            <div>
              <span className="inline-block text-caption uppercase tracking-widest text-muted-foreground mb-4">
                For Retailers
              </span>
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0">
                  <Store className="w-6 h-6 text-accent" />
                </div>
                <h2 className="text-display-sm md:text-display-md font-display font-bold">
                  Stock print that makes your space unforgettable.
                </h2>
              </div>
              <div className="text-body-lg text-muted-foreground space-y-4 mb-6">
                <p>
                  Magazines give a shop character. They spark conversations, set the vibe, and make customers linger. But clunky portals and risky bets have made them a nightmare to stock. Neesh fixes that.
                </p>
                <p>
                  With Neesh you can browse hundreds of independent titles in one place and order directly from publishers. Build real relationships while getting transparent pricing, coordinated shipping, and the flexibility to start small and scale what sells.
                </p>
              </div>
              <Link
                to="/retailers"
                className="inline-flex items-center text-body font-medium text-foreground hover:text-accent transition-colors"
              >
                For Retailers →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 md:px-6">
          <h2 className="text-display-md md:text-display-lg font-display font-bold text-center mb-12 md:mb-16">
            How it works
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
            {/* Step 1 */}
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-6">
                <FileText className="w-7 h-7 text-foreground" />
              </div>
              <h3 className="text-heading font-display font-semibold mb-3">
                Publishers list. Retailers discover.
              </h3>
              <p className="text-body text-muted-foreground">
                Publishers upload catalog, pricing and terms. Retailers browse a curated marketplace and find titles that match their aesthetic and customers.
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-6">
                <Search className="w-7 h-7 text-foreground" />
              </div>
              <h3 className="text-heading font-display font-semibold mb-3">
                Direct relationships, better rates
              </h3>
              <p className="text-body text-muted-foreground">
                Retailers order directly from publishers—no middleman taking inventory or markup. Neesh coordinates shipping and gets everyone rates better than they could negotiate alone.
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-6">
                <Send className="w-7 h-7 text-foreground" />
              </div>
              <h3 className="text-heading font-display font-semibold mb-3">
                Publishers fulfill on their terms
              </h3>
              <p className="text-body text-muted-foreground">
                Publishers ship directly to retailers using our coordinated shipping rates. Everyone gets tracking, confirmation, and transparency.
              </p>
            </div>

            {/* Step 4 */}
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-6">
                <LayoutDashboard className="w-7 h-7 text-foreground" />
              </div>
              <h3 className="text-heading font-display font-semibold mb-3">
                One dashboard for all your retail accounts
              </h3>
              <p className="text-body text-muted-foreground">
                Publishers see orders, payments, and performance in one place. Retailers track magazine orders across publishers—with the data everyone needs to grow.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-16 md:py-24 bg-secondary">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Text Content */}
            <div>
              <h2 className="text-display-md md:text-display-lg font-display font-bold mb-6">
                Print is alive. Neesh makes it work.
              </h2>
              <div className="text-body-lg text-muted-foreground space-y-4 mb-8">
                <p>
                  Magazines are carrying culture forward—building loyal audiences and creating moments that digital can't touch. Neesh gives independent publishers the business infrastructure they've never had: a way to connect with retailers, coordinate logistics, and manage growth without giving up control.
                </p>
                <p>
                  We're not replacing traditional distribution. We're enabling direct distribution.
                </p>
              </div>

              <h3 className="text-heading font-display font-semibold mb-4">
                Built for Indie Print:
              </h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                  <span className="text-body">
                    Discovery platform for the right retailer—publisher matches
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                  <span className="text-body">
                    Negotiated shipping rates without handing over inventory
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                  <span className="text-body">
                    Coordinated fulfillment with tracking and transparency
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                  <span className="text-body">
                    Unified dashboard for accounts, orders, and payments
                  </span>
                </div>
              </div>
            </div>

            {/* YouTube Video */}
            <div>
              <div className="aspect-[4/3] rounded-lg overflow-hidden bg-muted">
                <iframe
                  src="https://www.youtube.com/embed/393cjk5hc5Q?autoplay=0&rel=0"
                  title="Neesh - The Marketplace for Independent Magazines"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 md:py-32 relative overflow-hidden">
        {/* Left Image - Couch */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/4 w-[280px] md:w-[320px] lg:w-[380px] hidden md:block">
          <div className="aspect-[2/3] rounded-lg overflow-hidden shadow-lg">
            <img
              src={ctaCouch}
              alt="Person reading magazines on a couch"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Right Image - Flowers */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/4 w-[280px] md:w-[320px] lg:w-[380px] hidden md:block">
          <div className="aspect-[2/3] rounded-lg overflow-hidden shadow-lg">
            <img
              src={ctaFlowers}
              alt="Flowers in a vase on top of stacked magazines"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        <div className="container mx-auto px-4 md:px-6 relative z-10">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-display-md md:text-display-lg font-display font-bold mb-2">
              Find Your Neesh.
            </h2>
            <p className="text-display-sm md:text-display-md font-display font-bold mb-10">
              Keep Indie Print Moving Forward.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/publishers">
                <ButtonPrimary variant="black" className="text-base px-8 py-3 min-w-[160px]">
                  For Publishers
                </ButtonPrimary>
              </Link>
              <Link to="/retailers">
                <ButtonPrimary variant="black" className="text-base px-8 py-3 min-w-[160px]">
                  For Retailers
                </ButtonPrimary>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
};
