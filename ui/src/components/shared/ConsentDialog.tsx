import { Button } from '@/src/components/ui/button'

interface ConsentDialogProps {
  showConsent: boolean
  onConsentClick: (consent: boolean) => void
}

export function ConsentDialog({ showConsent, onConsentClick }: ConsentDialogProps) {
  if (!showConsent) return null

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-[488px] border border-[var(--border)] rounded-xl px-6 py-3 bg-[var(--color-background-neutral-faded)] shadow-md animate-fadeIn">
      <div className="flex items-center justify-between w-full">
        <h2 className="title-2 flex items-center">
          <span className="text-normal-accent">Help Us Improve</span>
        </h2>
      </div>

      <p className="w-full text-left font-regular font-weight-[400] font-size-[16px] font-color-[var(--color-foreground-neutral-faded)]">
        Sharing anonymous usage data helps us better understand how this tool is used. This allows us to prioritize
        improvements that will benefit the entire community.
      </p>

      <div className="w-full flex items-center justify-end gap-4">
        <Button
          variant="tertiary"
          type="button"
          size="custom"
          onClick={() => onConsentClick(false)}
        >
          Do Not Consent
        </Button>
        <Button
          variant="primary"
          type="button"
          size="custom"
          onClick={() => onConsentClick(true)}
        >
          Confirm
        </Button>
      </div>
    </div>
  )
}
