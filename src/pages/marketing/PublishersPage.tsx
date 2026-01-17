import { Link } from 'react-router-dom';
import { Search, Send, LayoutDashboard, FileText } from 'lucide-react';
import { MarketingLayout } from '@/components/marketing/MarketingLayout';
import { ButtonPrimary } from '@/components/neesh/ButtonPrimary';

export const PublishersPage = () => {
  return (
    <MarketingLayout>
      {/* Hero Section */}
      <section className="py-16 md:py-24 lg:py-32">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Text Content */}
            <div className="order-2 lg:order-1">
              <h1 className="text-display-lg md:text-[3.5rem] lg:text-[4rem] leading-[1.05] font-display font-bold mb-4">
                For Publishers
              </h1>
              <p className="text-display-sm md:text-display-md text-muted-foreground mb-6">
                Traditional reach without traditional margins.
              </p>
              <p className="text-body-lg text-muted-foreground mb-8 max-w-lg">
                Self-distribution gives you control but limits your reach. Traditional distributors give you reach but take your control (and your inventory, and your margins, and half a year to pay you). Neesh gives you both: direct access to retailers nationwide while you maintain control, ship on your terms, and get paid fast.
              </p>
              <Link to="/apply/publisher">
                <ButtonPrimary variant="black" className="text-base px-8 py-3">
                  Apply to List Your Magazine
                </ButtonPrimary>
              </Link>
            </div>

            {/* Hero Image */}
            <div className="order-1 lg:order-2">
              <div className="aspect-[4/3] rounded-lg overflow-hidden bg-secondary">
                <div className="w-full h-full bg-gradient-to-br from-muted to-secondary flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">Publisher Workspace Image</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Publishers Choose Neesh Section */}
      <section className="bg-secondary py-16 md:py-24">
        <div className="container mx-auto px-4 md:px-6">
          <h2 className="text-display-md md:text-display-lg font-display font-bold text-center mb-12 md:mb-16">
            Why Publishers Choose Neesh
          </h2>

          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            {/* Reach New Retailers */}
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-background flex items-center justify-center mx-auto mb-6">
                <Search className="w-7 h-7 text-foreground" />
              </div>
              <h3 className="text-heading font-display font-semibold mb-3">
                Reach New Retailers
              </h3>
              <p className="text-body text-muted-foreground">
                Get discovered by local bookstores, cafes, boutiques, and specialty shops nationwide. They find you through our curated marketplace. You build direct relationships. No distributor as gatekeeper.
              </p>
            </div>

            {/* Better Shipping Rates */}
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-background flex items-center justify-center mx-auto mb-6">
                <Send className="w-7 h-7 text-foreground" />
              </div>
              <h3 className="text-heading font-display font-semibold mb-3">
                Better Shipping Rates
              </h3>
              <p className="text-body text-muted-foreground">
                We negotiate shipping rates on behalf of all publishers on the platform. You get pricing you couldn't access alone, without handing over inventory or control to a distributor.
              </p>
            </div>

            {/* One Dashboard */}
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-background flex items-center justify-center mx-auto mb-6">
                <LayoutDashboard className="w-7 h-7 text-foreground" />
              </div>
              <h3 className="text-heading font-display font-semibold mb-3">
                One Dashboard for Everything
              </h3>
              <p className="text-body text-muted-foreground">
                Manage all your retail accounts in one place. See orders, track shipments, monitor payments, and understand what's selling where—instead of juggling spreadsheets and email threads.
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
                Share basic details about your magazine: print runs, distribution goals, publishing schedule, and what makes your publication unique.
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
                Our team reviews your application based on editorial quality, design standards, and operational readiness. We carefully curate our titles to maintain quality for everyone.
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-6 text-heading font-bold">
                3
              </div>
              <h3 className="text-heading font-display font-semibold mb-3">
                List Your Catalog
              </h3>
              <p className="text-body text-muted-foreground">
                Upload your catalog with wholesale pricing and terms. Your magazines become discoverable to retailers nationwide. You control which stores can order and on what terms.
              </p>
            </div>

            {/* Step 4 */}
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-6 text-heading font-bold">
                4
              </div>
              <h3 className="text-heading font-display font-semibold mb-3">
                Ship & Get Paid
              </h3>
              <p className="text-body text-muted-foreground">
                When retailers order, you ship directly to them using our coordinated shipping rates. Track everything through your dashboard. Get paid on your terms. Not in six months.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What We're Looking For Section */}
      <section className="bg-secondary py-16 md:py-24">
        <div className="container mx-auto px-4 md:px-6">
          <h2 className="text-display-md md:text-display-lg font-display font-bold text-center mb-12 md:mb-16">
            What We're Looking For
          </h2>

          <div className="grid sm:grid-cols-2 gap-6 lg:gap-8 max-w-4xl mx-auto">
            {/* Print Runs */}
            <div className="bg-background rounded-lg p-6 md:p-8">
              <h3 className="text-heading font-display font-semibold mb-3">
                Print Runs
              </h3>
              <p className="text-body text-muted-foreground">
                We work best with publishers printing between 500-10,000 copies per issue. This ensures you have inventory to fulfill retailer demand without overextending.
              </p>
            </div>

            {/* Quality Focus */}
            <div className="bg-background rounded-lg p-6 md:p-8">
              <h3 className="text-heading font-display font-semibold mb-3">
                Quality Focus
              </h3>
              <p className="text-body text-muted-foreground">
                We review every application for editorial quality, design standards, and production values. Neesh is a design-forward, curated marketplace.
              </p>
            </div>

            {/* Operational Readiness */}
            <div className="bg-background rounded-lg p-6 md:p-8">
              <h3 className="text-heading font-display font-semibold mb-3">
                Operational Readiness
              </h3>
              <p className="text-body text-muted-foreground">
                You should have established printing and fulfillment capabilities, plus a regular publishing schedule. We're looking for publishers ready to grow, not just starting out.
              </p>
            </div>

            {/* Independent Spirit */}
            <div className="bg-background rounded-lg p-6 md:p-8">
              <h3 className="text-heading font-display font-semibold mb-3">
                Independent Spirit
              </h3>
              <p className="text-body text-muted-foreground">
                We prioritize independent publishers bringing unique voices and perspectives to the marketplace. If you're making something no one else is, we want to help you get it into the right hands.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-display-md md:text-display-lg font-display font-bold mb-4">
              Stop chasing invoices. Start reaching more stores.
            </h2>
            <p className="text-body-lg md:text-xl text-muted-foreground mb-10">
              Join independent publishers using Neesh to get stocked in cultural retailers across the country.
            </p>
            <Link to="/apply/publisher">
              <ButtonPrimary variant="black" className="text-base px-8 py-3">
                Apply to List Your Magazine
              </ButtonPrimary>
            </Link>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
};
