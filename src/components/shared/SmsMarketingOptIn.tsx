import type { Ref } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { FormInput } from "@/components/neesh";
import { MARKETING_OPT_IN_LABEL, SMS_MARKETING_DISCLOSURE } from "@/lib/sms-consent";

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

// One optional, unticked box for marketing email and text. Carriers need
// text consent to be separate from accepting the terms and never pre-ticked.
// The number field appears once the box is ticked; left blank, it's email only.
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
        {MARKETING_OPT_IN_LABEL} (optional)
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
          label="Mobile number for texts (optional)"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="503 555 1234"
          value={phone}
          onChange={onPhoneChange}
          error={phoneError}
        />
      </div>
    )}
  </div>
);
