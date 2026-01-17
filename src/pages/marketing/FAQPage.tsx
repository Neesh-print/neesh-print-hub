import { MarketingLayout } from '@/components/marketing/MarketingLayout';
import { ButtonSecondary } from '@/components/neesh/ButtonSecondary';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const faqData = {
  general: {
    title: 'General',
    questions: [
      {
        q: 'What is Neesh?',
        a: 'Neesh is a wholesale marketplace connecting independent magazine publishers with design-forward retailers like bookstores, cafes, galleries, and boutiques. Publishers list their titles, retailers browse and order directly, and everyone gets better rates and less hassle than traditional distribution.',
      },
      {
        q: 'How is Neesh different from traditional distributors?',
        a: "Traditional distributors take your inventory, control your pricing, and can take months to pay you. With Neesh, you keep your inventory, ship directly to retailers, set your own terms, and get paid weekly. We handle discovery, coordination, and shipping rates—not your stock.",
      },
      {
        q: 'Is Neesh available internationally?',
        a: "We currently support publishers and retailers in the US, UK, Canada, and EU. We're expanding to more regions soon. If you're outside these areas, apply anyway and we'll let you know when we're ready for you.",
      },
    ],
  },
  publishers: {
    title: 'For Publishers',
    questions: [
      {
        q: 'How do I get my magazine on Neesh?',
        a: 'Apply through our publisher application. Tell us about your magazine, upload a cover image, and share your website or Instagram. We review applications within 2-3 business days and look for quality editorial content, established print runs, and operational readiness.',
      },
      {
        q: 'What does it cost to list on Neesh?',
        a: 'Nothing upfront. We charge a 10% commission on completed orders only. No listing fees, no monthly fees, no hidden costs.',
      },
      {
        q: 'How do payouts work?',
        a: 'We process payouts weekly. When an order is marked delivered, your earnings (minus the 10% commission) are queued for the next payout cycle. Most publishers receive funds within 7-10 days of order completion.',
      },
      {
        q: 'Do I need to send inventory to Neesh?',
        a: 'No. You keep your inventory and ship directly to retailers when orders come in. We coordinate shipping rates so you get better pricing, but you stay in control of your stock.',
      },
      {
        q: 'Can I choose which retailers can order from me?',
        a: 'Yes. You can review retailer profiles and approve or decline orders. You set your own terms, minimums, and geographic restrictions.',
      },
    ],
  },
  retailers: {
    title: 'For Retailers',
    questions: [
      {
        q: 'How do I get access to order from Neesh?',
        a: "Apply through our retailer application. Tell us about your store, your customers, and what kind of magazines you're looking for. We review applications within 2-3 business days.",
      },
      {
        q: 'Is there a minimum order?',
        a: 'Minimums are set by individual publishers, but most welcome small trial orders. You can typically start with just 2-5 copies of a title to test what sells.',
      },
      {
        q: 'How does shipping work?',
        a: "Publishers ship directly to you using coordinated shipping rates negotiated across the platform. You get tracking on every order and can see shipping costs upfront before you buy.",
      },
      {
        q: "Can I return magazines that don't sell?",
        a: 'Returns are handled case-by-case and depend on publisher policies. Many publishers accept returns on approved items. Check individual publisher terms or reach out to discuss before ordering.',
      },
      {
        q: 'Do I need a subscription to use Neesh?',
        a: 'No. There are no subscriptions, monthly fees, or lock-ins. You only pay for what you order at wholesale prices.',
      },
    ],
  },
  shipping: {
    title: 'Orders & Shipping',
    questions: [
      {
        q: 'How long does shipping take?',
        a: "Most orders ship within 3-5 business days and arrive within 5-10 business days depending on your location and the publisher's location. You'll receive tracking information when your order ships.",
      },
      {
        q: 'Can I order from multiple publishers at once?',
        a: "Yes. You can add titles from multiple publishers to your cart and check out together. Each publisher will ship their items separately, but you'll track everything in one dashboard.",
      },
      {
        q: "What if there's a problem with my order?",
        a: "Contact us at hi@neesh.art and we'll help resolve any issues. We're here to make sure both publishers and retailers have a smooth experience.",
      },
    ],
  },
};

export const FAQPage = () => {
  return (
    <MarketingLayout>
      {/* Header Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center max-w-2xl mx-auto">
            <h1 className="text-display-lg md:text-[3.5rem] lg:text-[4rem] leading-[1.05] font-display font-bold mb-4">
              Frequently Asked Questions
            </h1>
            <p className="text-body-lg md:text-xl text-muted-foreground">
              Everything you need to know about selling and stocking with Neesh.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ Sections */}
      <section className="pb-16 md:pb-24">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-3xl mx-auto space-y-12">
            {Object.entries(faqData).map(([key, category]) => (
              <div key={key}>
                <h2 className="text-display-sm font-display font-bold mb-6">
                  {category.title}
                </h2>
                <Accordion type="single" collapsible className="w-full">
                  {category.questions.map((item, index) => (
                    <AccordionItem key={index} value={`${key}-${index}`}>
                      <AccordionTrigger className="text-left text-body-lg font-medium hover:no-underline hover:text-accent">
                        {item.q}
                      </AccordionTrigger>
                      <AccordionContent className="text-body text-muted-foreground">
                        {item.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="pb-20 md:pb-32">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center max-w-xl mx-auto">
            <h2 className="text-display-sm font-display font-bold mb-4">
              Still have questions?
            </h2>
            <p className="text-body-lg text-muted-foreground mb-6">
              Reach out anytime at{' '}
              <a href="mailto:hi@neesh.art" className="text-accent hover:underline">
                hi@neesh.art
              </a>
            </p>
            <a href="mailto:hi@neesh.art">
              <ButtonSecondary>Contact Us</ButtonSecondary>
            </a>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
};
