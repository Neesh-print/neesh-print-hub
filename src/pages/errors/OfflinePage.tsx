import { WifiOff } from "lucide-react";
import { ButtonPrimary, Logo } from "@/components/neesh";

export default function OfflinePage() {
  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className="mb-12">
        <Logo size="lg" />
      </div>

      {/* Icon */}
      <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-8">
        <WifiOff className="w-10 h-10 text-muted-foreground" />
      </div>

      {/* Heading */}
      <h1 className="text-2xl md:text-3xl font-semibold text-foreground mb-3 text-center">
        You're offline
      </h1>

      {/* Description */}
      <p className="text-muted-foreground text-center max-w-md mb-8">
        Please check your internet connection and try again.
      </p>

      {/* Actions */}
      <ButtonPrimary onClick={handleRetry}>
        Try Again
      </ButtonPrimary>
    </div>
  );
}
