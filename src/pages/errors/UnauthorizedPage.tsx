import { useNavigate } from "react-router-dom";
import { ShieldX } from "lucide-react";
import { ButtonPrimary, ButtonSecondary, Logo } from "@/components/neesh";

export default function UnauthorizedPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className="mb-12">
        <Logo size="lg" />
      </div>

      {/* Icon */}
      <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-8">
        <ShieldX className="w-10 h-10 text-red-600" />
      </div>

      {/* Heading */}
      <h1 className="text-2xl md:text-3xl font-semibold text-foreground mb-3 text-center">
        Access Denied
      </h1>

      {/* Description */}
      <p className="text-muted-foreground text-center max-w-md mb-8">
        You don't have permission to view this page. If you think this is a mistake, please contact support.
      </p>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <ButtonPrimary onClick={() => navigate('/')}>
          Go Home
        </ButtonPrimary>
        <ButtonSecondary onClick={() => navigate(-1)}>
          Go Back
        </ButtonSecondary>
      </div>

      {/* Contact Support */}
      <a
        href="mailto:hi@neesh.art"
        className="text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors"
      >
        Contact Support
      </a>
    </div>
  );
}
