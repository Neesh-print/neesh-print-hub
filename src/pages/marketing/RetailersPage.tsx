import { Link } from 'react-router-dom';
import { Search, Handshake, LayoutDashboard } from 'lucide-react';
import retailersHeroImage from '@/assets/retailers-hero.jpg';
import { MarketingLayout } from '@/components/marketing/MarketingLayout';
import { ButtonPrimary } from '@/components/neesh/ButtonPrimary';

export const RetailersPage = () => {
  return (
    <MarketingLayout>
      {/* Hero Section */}
      <section className="py-16 md:py-24 lg:py-32">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Text Content */}
            <div className="order-2 lg:order-1">
              <h1 className="text-display-lg md:text-[3.5rem] lg:text-[4rem] leading-[1.05] font-display font-bold mb-4">
                For Retailers
              </h1>
              <p className="text-display-sm md:text-display-md text-muted-foreground mb-6">
                Discover & stock hyper-niche indie magazines.
              </p>
              <p className="text-body-lg text-muted-foreground mb-8 max-w-lg">
                No more tracking down publishers one by one or waiting months for distributors to pay attention to your requests. Browse curated titles, order directly from publishers, and build real relationships, all through one platform.
              </p>
              <Link to="/apply/retailer">
                <ButtonPrimary variant="black" className="text-base px-8 py-3">
                  Request Access for Your Shop
                </ButtonPrimary>
              </Link>
            </div>

            {/* Hero Image */}
            <div className="order-1 lg:order-2">
              <div className="aspect-[4/3] rounded-lg overflow-hidden bg-secondary">
                <img 
                  src={retailersHeroImage} 
                  alt="Beautiful independent magazine shop interior with curated displays" 
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Retailers Choose Neesh Section */}
      <section className="bg-secondary py-16 md:py-24">
        <div className="container mx-auto px-4 md:px-6">
          <h2 className="text-display-md md:text-display-lg font-display font-bold text-center mb-12 md:mb-16">
            Why Retailers Choose Neesh
          </h2>

          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            {/* Curated Discovery */}
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-background flex items-center justify-center mx-auto mb-6">
                <Search className="w-7 h-7 text-foreground" />
              </div>
              <h3 className="text-heading font-display font-semibold mb-3">
                Curated Discovery
              </h3>
              <p className="text-body text-muted-foreground">
                Browse hundreds of independent magazines in one place. We vet every publisher for quality, so you're not wading through noise. Find titles that match your store's aesthetic and customers.
              </p>
            </div>

            {/* Direct Relationships */}
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-background flex items-center justify-center mx-auto mb-6">
                <Handshake className="w-7 h-7 text-foreground" />
              </div>
              <h3 className="text-heading font-display font-semibold mb-3">
                Direct Relationships
              </h3>
              <p className="text-body text-muted-foreground">
                Order directly from publishers. No distributor markup or six-month delays. Build real relationships with the makers. Negotiate terms that work for both of you.
              </p>
            </div>

            {/* Transparent Terms */}
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-background flex items-center justify-center mx-auto mb-6">
                <LayoutDashboard className="w-7 h-7 text-foreground" />
              </div>
              <h3 className="text-heading font-display font-semibold mb-3">
                Transparent Terms
              </h3>
              <p className="text-body text-muted-foreground">
                See pricing, shipping costs, and publisher terms upfront. Track orders in one dashboard. No surprises or hidden fees—just a straightforward business relationship with independent publishers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 md:px-6">
          <h2 className="text-display-md md:text-display-lg font-display font-bold text-center mb-12 md:mb-16">
            How It Works
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
            {/* Step 1 */}
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-6 text-heading font-bold">
                1
              </div>
              <h3 className="text-heading font-display font-semibold mb-3">
                Apply
              </h3>
              <p className="text-body text-muted-foreground">
                Tell us about your shop, your customers, and what kind of magazines you're looking for.
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-6 text-heading font-bold">
                2
              </div>
              <h3 className="text-heading font-display font-semibold mb-3">
                Get Approved
              </h3>
              <p className="text-body text-muted-foreground">
                We review your application and set up your account with access to our curated catalog of independent publishers.
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-6 text-heading font-bold">
                3
              </div>
              <h3 className="text-heading font-display font-semibold mb-3">
                Browse & Order
              </h3>
              <p className="text-body text-muted-foreground">
                Explore hundreds of magazines, see transparent pricing and terms, and order directly from publishers. Start small, scale what works.
              </p>
            </div>

            {/* Step 4 */}
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-6 text-heading font-bold">
                4
              </div>
              <h3 className="text-heading font-display font-semibold mb-3">
                Receive & Reorder
              </h3>
              <p className="text-body text-muted-foreground">
                Publishers ship directly to you. Track everything in your dashboard. Reorder what sells, try new titles, and build relationships with publishers making work you love.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Curated for Your Shop Section */}
      <section className="bg-secondary py-16 md:py-24">
        <div className="container mx-auto px-4 md:px-6">
          <h2 className="text-display-md md:text-display-lg font-display font-bold text-center mb-12 md:mb-16">
            Curated for Your Shop
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {/* Independent Bookstores */}
            <div className="bg-background rounded-lg p-6 md:p-8">
              <h3 className="text-heading font-display font-semibold mb-3">
                Independent Bookstores
              </h3>
              <p className="text-body text-muted-foreground">
                Complement your book selection with magazines that reflect your literary sensibility and community interests.
              </p>
            </div>

            {/* Coffee Shops & Cafes */}
            <div className="bg-background rounded-lg p-6 md:p-8">
              <h3 className="text-heading font-display font-semibold mb-3">
                Coffee Shops & Cafes
              </h3>
              <p className="text-body text-muted-foreground">
                Give customers something engaging to read while they enjoy their coffee. Create a space worth lingering in.
              </p>
            </div>

            {/* Art & Design Stores */}
            <div className="bg-background rounded-lg p-6 md:p-8">
              <h3 className="text-heading font-display font-semibold mb-3">
                Art & Design Stores
              </h3>
              <p className="text-body text-muted-foreground">
                Stock magazines that inspire creativity and showcase the latest in art, design, and culture.
              </p>
            </div>

            {/* Lifestyle Boutiques */}
            <div className="bg-background rounded-lg p-6 md:p-8">
              <h3 className="text-heading font-display font-semibold mb-3">
                Lifestyle Boutiques
              </h3>
              <p className="text-body text-muted-foreground">
                Curate magazines that align with your brand and give customers insights into the world you're building.
              </p>
            </div>

            {/* Record Stores */}
            <div className="bg-background rounded-lg p-6 md:p-8">
              <h3 className="text-heading font-display font-semibold mb-3">
                Record Stores
              </h3>
              <p className="text-body text-muted-foreground">
                Add music and culture magazines that complement your vinyl selection and reflect the movements happening right now.
              </p>
            </div>

            {/* Specialty Retailers */}
            <div className="bg-background rounded-lg p-6 md:p-8">
              <h3 className="text-heading font-display font-semibold mb-3">
                Specialty Retailers
              </h3>
              <p className="text-body text-muted-foreground">
                Whether you sell vintage goods, handmade items, or unique finds, magazines help you tell the story behind your shop.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Print That Pays Off Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 md:px-6">
          <h2 className="text-display-md md:text-display-lg font-display font-bold text-center mb-12 md:mb-16">
            Print that pays off.
          </h2>

          <div className="grid sm:grid-cols-2 gap-6 lg:gap-8 max-w-4xl mx-auto">
            {/* Small Trial Orders */}
            <div className="bg-secondary rounded-lg p-6 md:p-8">
              <h3 className="text-heading font-display font-semibold mb-3">
                Small Trial Orders
              </h3>
              <p className="text-body text-muted-foreground">
                Start with just a few copies to test what works. Most publishers welcome small orders. No pressure to buy in bulk.
              </p>
            </div>

            {/* Coordinated Shipping */}
            <div className="bg-secondary rounded-lg p-6 md:p-8">
              <h3 className="text-heading font-display font-semibold mb-3">
                Coordinated Shipping
              </h3>
              <p className="text-body text-muted-foreground">
                Benefit from shipping rates negotiated across the platform. Get tracking and transparency even though you're ordering directly from publishers.
              </p>
            </div>

            {/* Direct Publisher Relationships */}
            <div className="bg-secondary rounded-lg p-6 md:p-8">
              <h3 className="text-heading font-display font-semibold mb-3">
                Direct Publisher Relationships
              </h3>
              <p className="text-body text-muted-foreground">
                Build real connections with the people making the magazines. Provide feedback, request special orders, become part of their community.
              </p>
            </div>

            {/* Discovery Tools */}
            <div className="bg-secondary rounded-lg p-6 md:p-8">
              <h3 className="text-heading font-display font-semibold mb-3">
                Discovery Tools
              </h3>
              <p className="text-body text-muted-foreground">
                Use filters and recommendations to find magazines that match your store's vibe. See what similar retailers are stocking and what's trending.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 md:py-32 bg-secondary">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-display-md md:text-display-lg font-display font-bold mb-4">
              Ready to make your space worth staying for?
            </h2>
            <p className="text-body-lg md:text-xl text-muted-foreground mb-10">
              Join retailers using Neesh to find independent magazines their customers actually want and build direct relationships with the publishers making them.
            </p>
            <Link to="/apply/retailer">
              <ButtonPrimary variant="black" className="text-base px-8 py-3">
                Request Access for Your Shop
              </ButtonPrimary>
            </Link>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
};
