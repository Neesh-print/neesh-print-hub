import { checkProfileCompletion, RetailerProfileData } from "@/lib/profile-completion";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2 } from "lucide-react";

interface ProfileProgressProps {
  profile: RetailerProfileData;
}

export function ProfileProgress({ profile }: ProfileProgressProps) {
  const completion = checkProfileCompletion(profile);

  if (completion.isComplete) {
    return (
      <div className="flex items-center gap-3 p-4 bg-accent/10 border border-accent/30 rounded-lg">
        <CheckCircle2 className="w-5 h-5 text-accent" />
        <div>
          <p className="font-medium text-foreground">
            Profile Complete!
          </p>
          <p className="text-sm text-muted-foreground">
            Publishers can now find and learn about your store.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-cream dark:bg-secondary rounded-lg border border-border">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground">
          Profile Completion: {completion.completedCount} of {completion.totalRequired} required fields
        </span>
        <span className="text-sm font-medium">{completion.percentage}%</span>
      </div>
      
      <Progress value={completion.percentage} className="h-2 mb-3" />
      
      {completion.missingFields.length > 0 && (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium">Missing:</span>{' '}
          {completion.missingFields.join(', ')}
        </p>
      )}
    </div>
  );
}
