import type { Ref } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { FormInput } from "@/components/neesh";
import { SMS_MARKETING_DISCLOSURE } from "@/lib/sms-consent";

interface SmsMarketingOptInProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  phone: string;
  onPhoneChange: (phone: string) => void;
  phoneError?: string;
  /** Lets the form focus the number field when it fails validation. */
  phoneRef?: Ref<HTMLInputElement>;
  /** Matches the surrounding checkboxes, which differ between the two forms. */
  textClassName?: string;
}

// Optional and unticked by default: carriers require marketing SMS consent
// to be a separate, affirmative choice. The number field only appears once
// the box is ticked, since it's only used for these texts.
export const SmsMarketingOptIn = ({
  checked,
  onCheckedChange,
  phone,
  onPhoneChange,
  phoneError,
  phoneRef,
  textClassName = "text-sm text-muted-foreground",
}: SmsMarketingOptInProps) => (
  <div className="space-y-3">
    <label className="flex items-start gap-3 cursor-pointer">
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        className="mt-0.5"
        aria-describedby="sms-marketing-disclosure"
      />
      <span className={textClassName}>
        Text me marketing messages from Neesh (optional)
        <span id="sms-marketing-disclosure" className="block mt-1 text-xs text-muted-foreground">
          {SMS_MARKETING_DISCLOSURE} See our{" "}
          <a href="/legal/terms" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">Terms of Service</a>{" "}
          and{" "}
          <a href="/legal/privacy" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">Privacy Policy</a>.
        </span>
      </span>
    </label>
    {checked && (
      <div className="pl-7">
        <FormInput
          ref={phoneRef}
          id="smsMarketingPhone"
          label="Mobile number"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="503 555 1234"
          value={phone}
          onChange={onPhoneChange}
          error={phoneError}
          required
        />
      </div>
    )}
  </div>
);
