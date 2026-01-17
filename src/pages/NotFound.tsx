import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Search } from "lucide-react";
import { ButtonPrimary, ButtonSecondary, Logo } from "@/components/neesh";

const NotFound = () => {
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", window.location.pathname);
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className="mb-12">
        <Logo size="lg" />
      </div>

      {/* Icon */}
      <div className="relative mb-8">
        <Search className="w-16 h-16 text-muted-foreground/30" />
        <div className="absolute -top-1 -right-1 w-6 h-6 bg-background rounded-full flex items-center justify-center">
          <span className="text-muted-foreground text-lg font-bold">×</span>
        </div>
      </div>

      {/* 404 Number */}
      <h1 className="text-[120px] md:text-[180px] font-bold leading-none text-muted-foreground/20 select-none">
        404
      </h1>

      {/* Heading */}
      <h2 className="text-2xl md:text-3xl font-semibold text-foreground mt-4 mb-3">
        Page not found
      </h2>

      {/* Description */}
      <p className="text-muted-foreground text-center max-w-md mb-8">
        The page you're looking for doesn't exist or has been moved.
      </p>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <ButtonPrimary onClick={() => navigate('/')}>
          Go Home
        </ButtonPrimary>
        <ButtonSecondary onClick={() => navigate(-1)}>
          Go Back
        </ButtonSecondary>
      </div>
    </div>
  );
};

export default NotFound;
