import { useState, useMemo } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Search, BookOpen, Package, CreditCard, Truck, Settings, RotateCcw, Mail, HelpCircle } from 'lucide-react';
import { PublisherLayout } from '@/components/publisher/PublisherLayout';
import { RetailerLayout } from '@/components/retailer/RetailerLayout';
import { CartProvider } from '@/components/retailer/CartContext';
import { WishlistProvider } from '@/components/retailer/WishlistContext';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

interface QuickLink {
  title: string;
  description: string;
  icon: React.ReactNode;
  category: string;
}

// Shared FAQ items for both roles
const sharedFAQs: FAQItem[] = [
  {
    question: "How does Neesh work?",
    answer: "Neesh connects independent magazine publishers directly with retailers. Publishers list their titles with wholesale pricing, retailers browse and order, and publishers ship directly. We coordinate shipping rates and handle payments so both sides get a better deal than traditional distribution.",
    category: "Getting Started"
  },
  {
    question: "How do I update my profile?",
    answer: "Go to Settings in your dashboard. You can update your business information, contact details, and notification preferences.",
    category: "Account Settings"
  },
  {
    question: "How do I contact support?",
    answer: "Email us anytime at hi@neesh.art. We typically respond within 24 hours on business days.",
    category: "Getting Started"
  },
];

// Publisher-specific FAQ items
const publisherFAQs: FAQItem[] = [
  {
    question: "How do I know when I have a new order?",
    answer: "You'll receive an email notification when a retailer places an order. You can also see all orders in your Orders dashboard.",
    category: "Orders & Fulfillment"
  },
  {
    question: "How long do I have to ship an order?",
    answer: "We recommend shipping within 3-5 business days of receiving an order. Prompt shipping builds trust with retailers and leads to repeat orders.",
    category: "Orders & Fulfillment"
  },
  {
    question: "How do I mark an order as shipped?",
    answer: "Go to Orders, find the order, click into the detail view, and add your tracking number. The retailer will be notified automatically.",
    category: "Orders & Fulfillment"
  },
  {
    question: "When do I get paid?",
    answer: "Payouts are processed weekly. Once an order is marked as delivered, your earnings are queued for the next payout cycle.",
    category: "Payments"
  },
  {
    question: "What is the commission rate?",
    answer: "Neesh takes a 10% commission on completed orders. This is calculated on the order subtotal before shipping and tax.",
    category: "Payments"
  },
  {
    question: "How do I set up my payout information?",
    answer: "Go to Settings > Payout Settings to add your bank account details. We'll need this before your first payout can be processed.",
    category: "Payments"
  },
  {
    question: "How do shipping rates work?",
    answer: "Neesh negotiates shipping rates on behalf of all publishers. You'll see the available rates when fulfilling an order. These rates are typically better than what you'd get individually.",
    category: "Shipping"
  },
  {
    question: "Can I use my own shipping account?",
    answer: "Yes, you can choose to use your own shipping account if you prefer. Just select 'Self-fulfill' when processing the order.",
    category: "Shipping"
  },
];

// Retailer-specific FAQ items
const retailerFAQs: FAQItem[] = [
  {
    question: "Is there a minimum order?",
    answer: "Minimums are set by individual publishers and vary by title. Many publishers accept small trial orders of just 2-5 copies.",
    category: "Orders"
  },
  {
    question: "How do I place an order?",
    answer: "Browse the catalog, add titles to your cart, and proceed to checkout. You'll enter your shipping address and payment information to complete the order.",
    category: "Orders"
  },
  {
    question: "Can I order from multiple publishers at once?",
    answer: "Yes! You can add titles from different publishers to your cart. Each publisher will ship their items separately, but you'll track everything in one dashboard.",
    category: "Orders"
  },
  {
    question: "How long does shipping take?",
    answer: "Most orders ship within 3-5 business days and arrive within 5-10 business days, depending on location. You'll receive tracking information when your order ships.",
    category: "Orders"
  },
  {
    question: "How do I track my order?",
    answer: "Go to Orders and click on any order to see its status and tracking information.",
    category: "Orders"
  },
  {
    question: "Can I return magazines that don't sell?",
    answer: "Return policies vary by publisher. Check the publisher's terms before ordering, or contact them directly to discuss return options.",
    category: "Returns"
  },
  {
    question: "How do I request a return?",
    answer: "Go to Orders, find the order, and click 'Request Return'. The publisher will review your request and respond within a few days.",
    category: "Returns"
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept all major credit cards through our secure checkout.",
    category: "Payments"
  },
  {
    question: "Are there any fees for retailers?",
    answer: "No subscription fees or membership costs. You simply pay wholesale prices for the titles you order.",
    category: "Payments"
  },
];

const publisherQuickLinks: QuickLink[] = [
  { title: "Getting Started", description: "Setting up your catalog", icon: <BookOpen className="w-6 h-6" />, category: "Getting Started" },
  { title: "Orders & Fulfillment", description: "Processing and shipping orders", icon: <Package className="w-6 h-6" />, category: "Orders & Fulfillment" },
  { title: "Payments", description: "Understanding payouts and commissions", icon: <CreditCard className="w-6 h-6" />, category: "Payments" },
  { title: "Shipping", description: "Rates and logistics", icon: <Truck className="w-6 h-6" />, category: "Shipping" },
  { title: "Account Settings", description: "Profile and preferences", icon: <Settings className="w-6 h-6" />, category: "Account Settings" },
];

const retailerQuickLinks: QuickLink[] = [
  { title: "Getting Started", description: "Browsing and ordering", icon: <BookOpen className="w-6 h-6" />, category: "Getting Started" },
  { title: "Orders", description: "Tracking and managing orders", icon: <Package className="w-6 h-6" />, category: "Orders" },
  { title: "Payments", description: "Billing and invoices", icon: <CreditCard className="w-6 h-6" />, category: "Payments" },
  { title: "Returns", description: "Return policies and process", icon: <RotateCcw className="w-6 h-6" />, category: "Returns" },
  { title: "Account Settings", description: "Profile and preferences", icon: <Settings className="w-6 h-6" />, category: "Account Settings" },
];

const HelpCenterContent = ({ userRole }: { userRole: 'publisher' | 'retailer' }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const quickLinks = userRole === 'publisher' ? publisherQuickLinks : retailerQuickLinks;
  const roleFAQs = userRole === 'publisher' ? publisherFAQs : retailerFAQs;
  const allFAQs = [...sharedFAQs, ...roleFAQs];

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(allFAQs.map(faq => faq.category));
    return Array.from(cats);
  }, [allFAQs]);

  // Filter FAQs based on search and category
  const filteredFAQs = useMemo(() => {
    return allFAQs.filter(faq => {
      const matchesSearch = searchQuery === '' || 
        faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = selectedCategory === null || faq.category === selectedCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [allFAQs, searchQuery, selectedCategory]);

  // Group FAQs by category
  const groupedFAQs = useMemo(() => {
    const groups: Record<string, FAQItem[]> = {};
    filteredFAQs.forEach(faq => {
      if (!groups[faq.category]) {
        groups[faq.category] = [];
      }
      groups[faq.category].push(faq);
    });
    return groups;
  }, [filteredFAQs]);

  const handleQuickLinkClick = (category: string) => {
    setSelectedCategory(category);
    setSearchQuery('');
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory(null);
  };

  return (
    <div className="container mx-auto px-4 md:px-6 py-6 md:py-8 max-w-4xl">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-secondary mb-4">
          <HelpCircle className="w-8 h-8 text-accent" />
        </div>
        <h1 className="text-display-md font-display font-bold mb-2">Help Center</h1>
        <p className="text-muted-foreground text-body-lg">Find answers to common questions</p>
      </div>

      {/* Search Input */}
      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setSelectedCategory(null);
          }}
          placeholder="Search for help..."
          className="w-full pl-12 pr-4 py-3 bg-white border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
        />
      </div>

      {/* Active Filter Badge */}
      {(selectedCategory || searchQuery) && (
        <div className="mb-6 flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Showing:</span>
          {selectedCategory && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-accent/10 text-accent rounded-full text-sm font-medium">
              {selectedCategory}
            </span>
          )}
          {searchQuery && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-secondary text-foreground rounded-full text-sm">
              "{searchQuery}"
            </span>
          )}
          <button
            onClick={clearFilters}
            className="text-sm text-accent hover:underline ml-2"
          >
            Clear
          </button>
        </div>
      )}

      {/* Quick Links */}
      {!searchQuery && !selectedCategory && (
        <div className="mb-10">
          <h2 className="text-heading font-display font-semibold mb-4">Quick Links</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {quickLinks.map((link) => (
              <button
                key={link.category}
                onClick={() => handleQuickLinkClick(link.category)}
                className="flex flex-col items-start p-4 bg-white border border-border rounded-lg hover:border-accent hover:shadow-sm transition-all text-left"
              >
                <span className="text-accent mb-2">{link.icon}</span>
                <h3 className="font-medium text-foreground mb-1">{link.title}</h3>
                <p className="text-sm text-muted-foreground">{link.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* FAQ Sections */}
      <div className="mb-10">
        <h2 className="text-heading font-display font-semibold mb-4">
          {selectedCategory ? selectedCategory : 'Frequently Asked Questions'}
        </h2>

        {filteredFAQs.length === 0 ? (
          <div className="text-center py-12 bg-secondary/50 rounded-lg">
            <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-heading font-medium mb-2">No results found</h3>
            <p className="text-muted-foreground mb-4">
              We couldn't find any answers matching "{searchQuery}"
            </p>
            <p className="text-muted-foreground">
              Need help? <a href="mailto:hi@neesh.art" className="text-accent hover:underline">Contact support</a>
            </p>
          </div>
        ) : (
          Object.entries(groupedFAQs).map(([category, faqs]) => (
            <div key={category} className="mb-6">
              {!selectedCategory && (
                <h3 className="text-body font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  {category}
                </h3>
              )}
              <Accordion type="single" collapsible className="space-y-2">
                {faqs.map((faq, index) => (
                  <AccordionItem
                    key={`${category}-${index}`}
                    value={`${category}-${index}`}
                    className="bg-white border border-border rounded-lg px-4 data-[state=open]:border-accent"
                  >
                    <AccordionTrigger className="text-left font-medium hover:no-underline py-4">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pb-4">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ))
        )}
      </div>

      {/* Contact Section */}
      <div className="bg-secondary rounded-xl p-6 md:p-8 text-center">
        <Mail className="w-10 h-10 text-accent mx-auto mb-4" />
        <h2 className="text-heading font-display font-semibold mb-2">Still need help?</h2>
        <p className="text-muted-foreground mb-4">
          Our team is here to help. Reach out and we'll get back to you within 24 hours.
        </p>
        <a
          href="mailto:hi@neesh.art"
          className="inline-flex items-center gap-2 px-6 py-3 bg-foreground text-background rounded-lg font-medium hover:bg-foreground/90 transition-colors"
        >
          <Mail className="w-4 h-4" />
          hi@neesh.art
        </a>
      </div>
    </div>
  );
};

// Publisher Help Center wrapped in PublisherLayout
export const PublisherHelpCenter = () => {
  return (
    <PublisherLayout>
      <HelpCenterContent userRole="publisher" />
    </PublisherLayout>
  );
};

// Retailer Help Center wrapped in RetailerLayout (needs Cart/Wishlist providers)
export const RetailerHelpCenter = () => {
  return (
    <WishlistProvider>
      <CartProvider>
        <RetailerLayout>
          <HelpCenterContent userRole="retailer" />
        </RetailerLayout>
      </CartProvider>
    </WishlistProvider>
  );
};
