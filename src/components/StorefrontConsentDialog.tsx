import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface StorefrontConsentDialogProps {
  open: boolean;
  onConfirm: (values: {
    emailNotifications: boolean;
    smsNotifications: boolean;
    marketingEmails: boolean;
  }) => Promise<void>;
}

const StorefrontConsentDialog = ({ open, onConfirm }: StorefrontConsentDialogProps) => {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);
  const [marketingEmails, setMarketingEmails] = useState(true);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!termsAccepted || !privacyAccepted) {
      toast.error("Accept Terms and Privacy Policy to continue.");
      return;
    }

    setBusy(true);
    try {
      await onConfirm({
        emailNotifications,
        smsNotifications,
        marketingEmails,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent className="storefront-theme max-w-lg">
        <DialogHeader>
          <DialogTitle>Client policy & consent</DialogTitle>
          <DialogDescription>
            Please confirm consent before we store your delivery details and checkout information.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="storefront-surface-chip !rounded-lg p-3 text-muted-foreground">
            By continuing, you consent to secure storage of your profile and delivery information for order fulfilment and customer support.
          </div>

          <div className="space-y-2">
            <Label className="inline-flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-1"
              />
              <span>I agree to the Terms of Service (required).</span>
            </Label>

            <Label className="inline-flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={privacyAccepted}
                onChange={(e) => setPrivacyAccepted(e.target.checked)}
                className="mt-1"
              />
              <span>I agree to the Privacy Policy and data processing (required).</span>
            </Label>
          </div>

          <div className="space-y-2">
            <Label className="inline-flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={emailNotifications}
                onChange={(e) => setEmailNotifications(e.target.checked)}
                className="mt-1"
              />
              <span>Receive order and delivery notifications by email.</span>
            </Label>

            <Label className="inline-flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={smsNotifications}
                onChange={(e) => setSmsNotifications(e.target.checked)}
                className="mt-1"
              />
              <span>Receive order updates by SMS.</span>
            </Label>

            <Label className="inline-flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={marketingEmails}
                onChange={(e) => setMarketingEmails(e.target.checked)}
                className="mt-1"
              />
              <span>Receive occasional product launches and marketing emails.</span>
            </Label>
          </div>
        </div>

        <Button onClick={submit} disabled={busy}>
          {busy ? "Saving consent..." : "Accept and continue"}
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default StorefrontConsentDialog;
