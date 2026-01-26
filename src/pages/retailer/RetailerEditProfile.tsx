import { useNavigate, useLocation } from "react-router-dom";
import { RetailerLayout } from "@/components/retailer";
import { BackNavigation } from "@/components/neesh";
import { EditProfileForm } from "@/components/retailer/EditProfileForm";

export const RetailerEditProfile = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Check if this is the first time editing (from onboarding)
  const isFirstTime = location.state?.firstTime || false;

  return (
    <RetailerLayout>
      <BackNavigation
        title="Edit Your Store Profile"
        onBack={() => navigate("/retailer/profile")}
      />

      <div className="px-4 md:px-6 pb-12 max-w-3xl mx-auto">
        <p className="text-muted-foreground mb-6">
          Complete your profile to help publishers learn about your store.
        </p>
        
        <EditProfileForm isFirstTime={isFirstTime} />
      </div>
    </RetailerLayout>
  );
};
