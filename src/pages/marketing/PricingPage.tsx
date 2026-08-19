import { MarketingLayout } from '@/components/marketing/MarketingLayout';

export const PricingPage = () => {
  return (
    <MarketingLayout>
      {/* Header Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center max-w-2xl mx-auto">
            <h1 className="text-display-lg md:text-[3.5rem] lg:text-[4rem] leading-[1.05] font-display font-bold mb-4">
              Pricing
            </h1>
            <p className="text-body-lg md:text-xl text-muted-foreground">
              Simple, transparent terms for publishers and retailers.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Cards Section */}
      <section className="pb-16 md:pb-24">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid md:grid-cols-2 gap-6 lg:gap-8 max-w-4xl mx-auto">
            {/* For Publishers Card */}
            <div className="border border-border rounded-lg p-8 md:p-10">
              <h2 className="text-display-sm font-display font-bold mb-3">
                For Publishers
              </h2>
              <p className="text-body text-muted-foreground mb-8">
                Keep creative control. We handle discovery, orders, and payouts.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-foreground mt-2 flex-shrink-0" />
                  <span className="text-body">10% commission on completed orders</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-foreground mt-2 flex-shrink-0" />
                  <span className="text-body">No listing fees</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-foreground mt-2 flex-shrink-0" />
                  <span className="text-body">Weekly payouts</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-foreground mt-2 flex-shrink-0" />
                  <span className="text-body">Returns processing supported</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-foreground mt-2 flex-shrink-0" />
                  <span className="text-body">Real-time sales and inventory tracking</span>
                </li>
              </ul>
            </div>

            {/* For Retailers Card */}
            <div className="border border-border rounded-lg p-8 md:p-10">
              <h2 className="text-display-sm font-display font-bold mb-3">
                For Retailers
              </h2>
              <p className="text-body text-muted-foreground mb-8">
                Stock independent titles with clear margins and low risk.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-foreground mt-2 flex-shrink-0" />
                  <span className="text-body">Wholesale pricing per title</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-foreground mt-2 flex-shrink-0" />
                  <span className="text-body">Small trial orders allowed</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-foreground mt-2 flex-shrink-0" />
                  <span className="text-body">Returns on approved requests, reviewed case-by-case</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-foreground mt-2 flex-shrink-0" />
                  <span className="text-body">No subscriptions or lock-ins</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-foreground mt-2 flex-shrink-0" />
                  <span className="text-body">Net-terms available on request</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Details Section */}
      <section className="pb-20 md:pb-32">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-2xl mx-auto space-y-8">
            {/* How payouts work */}
            <div className="border-l-4 border-accent pl-6 py-2">
              <h3 className="text-heading font-display font-semibold mb-2">
                How payouts work
              </h3>
              <p className="text-body text-muted-foreground">
                When an order is completed, we process publisher payouts weekly. Commission is applied to the order subtotal (before shipping and tax).
              </p>
            </div>

            {/* Returns */}
            <div className="border-l-4 border-accent pl-6 py-2">
              <h3 className="text-heading font-display font-semibold mb-2">
                Returns
              </h3>
              <p className="text-body text-muted-foreground">
                Retailer returns are approved case-by-case. Approved returns are reconciled against publisher payouts on the next cycle.
              </p>
            </div>

            {/* Questions */}
            <div className="border-l-4 border-accent pl-6 py-2">
              <h3 className="text-heading font-display font-semibold mb-2">
                Questions
              </h3>
              <p className="text-body text-muted-foreground">
                Reach us anytime at{' '}
                <a 
                  href="mailto:hi@neesh.art" 
                  className="text-accent hover:underline"
                >
                  hi@neesh.art
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
};
