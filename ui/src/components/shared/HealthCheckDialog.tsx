import { Button } from '@/src/components/ui/button'

interface HealthCheckDialogProps {
  showHealthCheck: boolean
  onTestConnection: () => void
  isConnected: boolean
  isLoading: boolean
}

export function HealthCheckDialog({
  showHealthCheck,
  onTestConnection,
  isConnected,
  isLoading,
}: HealthCheckDialogProps) {
  if (!showHealthCheck) return null

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-[488px] border border-[var(--border)] rounded-xl px-6 py-3 bg-[var(--color-background-neutral-faded)] shadow-lg animate-fadeIn z-50">
      <div className="flex items-center justify-between w-full">
        <h2 className="title-2 flex items-center">
          <span className="text-normal-accent">Troubleshoot Back-End Connection</span>
        </h2>
      </div>

      <p className="w-full text-left font-regular font-weight-[400] font-size-[16px] font-color-[var(--color-foreground-neutral-faded)]">
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Praesent consequat feugiat velit vel tempor. Sed vel
        elit ultricies, tristique nisi sed, eleifend ipsum. Donec vitae diam odio. Ut congue lorem odio, in venenatis
        diam pharetra ut. Proin odio tellus, gravida tristique diam ac, pharetra elementum justo. Nunc ante erat, dictum
        a erat sed, ultricies mattis turpis. Nullam ut auctor orci. Nunc vitae dapibus elit. Fusce at iaculis erat, sed
        faucibus nunc. Nunc id est eget quam vehicula cursus. Vestibulum luctus mi non lectus rhoncus fringilla. Integer
        et ante fringilla, eleifend ligula ut, sodales est. Nulla ultricies ligula ut justo interdum, eget convallis
        eros suscipit. Cras tincidunt libero vitae felis aliquam, in lobortis nisi tempus. Curabitur sit amet nulla
        lorem.
      </p>

      <div className="w-full flex items-center justify-between">
        <div className="flex flex-col items-start gap-2">
          <span className="text-sm font-medium text-[var(--color-foreground-neutral-faded)]">Back-End Status</span>
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                isLoading ? 'bg-yellow-500 animate-pulse' : isConnected ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className="text-sm font-medium">
              {isLoading ? 'Testing...' : isConnected ? 'Active' : 'Not Responding'}
            </span>
          </div>
        </div>

        <Button
          className="btn-primary"
          type="button"
          variant="gradient"
          size="custom"
          onClick={onTestConnection}
          disabled={isLoading}
        >
          {isLoading ? 'Testing...' : 'Test Connection'}
        </Button>
      </div>
    </div>
  )
}
