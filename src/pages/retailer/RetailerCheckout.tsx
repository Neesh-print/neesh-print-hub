import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { RetailerLayout, useCart } from "@/components/retailer";
import { BackNavigation, FormInput, FormSelect, ButtonPrimary } from "@/components/neesh";
import { toast } from "@/hooks/use-toast";

const countries = [
  { value: "us", label: "United States" },
  { value: "uk", label: "United Kingdom" },
  { value: "ca", label: "Canada" },
  { value: "au", label: "Australia" },
];

const states = [
  { value: "ca", label: "California" },
  { value: "ny", label: "New York" },
  { value: "tx", label: "Texas" },
  { value: "or", label: "Oregon" },
  { value: "wa", label: "Washington" },
];

export const RetailerCheckout = () => {
  const navigate = useNavigate();
  const { cartItems, cartTotal, clearCart } = useCart();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sameAsShipping, setSameAsShipping] = useState(true);

  const [shipping, setShipping] = useState({
    address: "",
    apt: "",
    city: "",
    state: "",
    postalCode: "",
    country: "us",
  });

  const [billing, setBilling] = useState({
    address: "",
    apt: "",
    city: "",
    state: "",
    postalCode: "",
    country: "us",
  });

  const [payment, setPayment] = useState({
    cardNumber: "",
    expiry: "",
    cvv: "",
    name: "",
  });

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  const shippingCost = 12.50;
  const tax = cartTotal * 0.08;
  const total = cartTotal + shippingCost + tax;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    clearCart();
    toast({ title: "Order placed successfully!" });
    navigate("/retailer/order-confirmation/ORD-001");
  };

  if (cartItems.length === 0) {
    navigate("/retailer/cart");
    return null;
  }

  return (
    <RetailerLayout>
      <BackNavigation
        title="Checkout"
        onBack={() => navigate("/retailer/cart")}
      />

      <form onSubmit={handleSubmit} className="px-4 md:px-6 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Forms */}
          <div className="lg:col-span-2 space-y-8">
            {/* Shipping Address */}
            <section className="card-neesh">
              <h2 className="font-display font-semibold text-lg text-foreground mb-4">
                Shipping Address
              </h2>
              <div className="space-y-4">
                <FormInput
                  label="Street address"
                  value={shipping.address}
                  onChange={(value) => setShipping({ ...shipping, address: value })}
                  required
                />
                <FormInput
                  label="Apt / Suite (optional)"
                  value={shipping.apt}
                  onChange={(value) => setShipping({ ...shipping, apt: value })}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormInput
                    label="City"
                    value={shipping.city}
                    onChange={(value) => setShipping({ ...shipping, city: value })}
                    required
                  />
                  <FormSelect
                    label="State / Province"
                    options={states}
                    value={shipping.state}
                    onChange={(value) => setShipping({ ...shipping, state: value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormInput
                    label="Postal code"
                    value={shipping.postalCode}
                    onChange={(value) => setShipping({ ...shipping, postalCode: value })}
                    required
                  />
                  <FormSelect
                    label="Country"
                    options={countries}
                    value={shipping.country}
                    onChange={(value) => setShipping({ ...shipping, country: value })}
                    required
                  />
                </div>
              </div>
            </section>

            {/* Billing Address */}
            <section className="card-neesh">
              <h2 className="font-display font-semibold text-lg text-foreground mb-4">
                Billing Address
              </h2>
              <label className="flex items-center gap-2 mb-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sameAsShipping}
                  onChange={(e) => setSameAsShipping(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
                />
                <span className="text-sm text-muted-foreground">Same as shipping address</span>
              </label>

              {!sameAsShipping && (
                <div className="space-y-4">
                  <FormInput
                    label="Street address"
                    value={billing.address}
                    onChange={(value) => setBilling({ ...billing, address: value })}
                    required
                  />
                  <FormInput
                    label="Apt / Suite (optional)"
                    value={billing.apt}
                    onChange={(value) => setBilling({ ...billing, apt: value })}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormInput
                      label="City"
                      value={billing.city}
                      onChange={(value) => setBilling({ ...billing, city: value })}
                      required
                    />
                    <FormSelect
                      label="State / Province"
                      options={states}
                      value={billing.state}
                      onChange={(value) => setBilling({ ...billing, state: value })}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormInput
                      label="Postal code"
                      value={billing.postalCode}
                      onChange={(value) => setBilling({ ...billing, postalCode: value })}
                      required
                    />
                    <FormSelect
                      label="Country"
                      options={countries}
                      value={billing.country}
                      onChange={(value) => setBilling({ ...billing, country: value })}
                      required
                    />
                  </div>
                </div>
              )}
            </section>

            {/* Payment */}
            <section className="card-neesh">
              <h2 className="font-display font-semibold text-lg text-foreground mb-4">
                Payment
              </h2>
              <div className="space-y-4">
                <FormInput
                  label="Card number"
                  value={payment.cardNumber}
                  onChange={(value) => setPayment({ ...payment, cardNumber: value })}
                  placeholder="1234 5678 9012 3456"
                  required
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormInput
                    label="Expiry date"
                    value={payment.expiry}
                    onChange={(value) => setPayment({ ...payment, expiry: value })}
                    placeholder="MM/YY"
                    required
                  />
                  <FormInput
                    label="CVV"
                    value={payment.cvv}
                    onChange={(value) => setPayment({ ...payment, cvv: value })}
                    placeholder="123"
                    required
                  />
                </div>
                <FormInput
                  label="Name on card"
                  value={payment.name}
                  onChange={(value) => setPayment({ ...payment, name: value })}
                  required
                />
                <p className="text-xs text-muted-foreground">🔒 Secured by Stripe</p>
              </div>
            </section>

            <ButtonPrimary type="submit" fullWidth loading={isSubmitting}>
              Place Order
            </ButtonPrimary>
          </div>

          {/* Right Column - Order Summary */}
          <div className="lg:col-span-1">
            <div className="card-neesh sticky top-20">
              <h2 className="font-display font-semibold text-lg text-foreground mb-4">
                Order Summary
              </h2>

              {/* Items */}
              <div className="space-y-3 mb-4">
                {cartItems.map((item) => (
                  <div key={item.magazineId} className="flex gap-3">
                    <div className="w-12 h-16 rounded overflow-hidden bg-secondary flex-shrink-0">
                      <img
                        src={item.coverImage}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-1">{item.title}</p>
                      <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                    </div>
                    <p className="text-sm font-medium">{formatPrice(item.price * item.quantity)}</p>
                  </div>
                ))}
              </div>

              <div className="border-t border-border pt-4 space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatPrice(cartTotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Shipping</span>
                  <span>{formatPrice(shippingCost)}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Tax</span>
                  <span>{formatPrice(tax)}</span>
                </div>
              </div>

              <div className="border-t border-border pt-4 mt-4">
                <div className="flex justify-between font-display font-bold text-lg text-foreground">
                  <span>Total</span>
                  <span>{formatPrice(total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </RetailerLayout>
  );
};
