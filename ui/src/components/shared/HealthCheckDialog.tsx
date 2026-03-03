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
        <span className="text-normal-accent">
          The GlassFlow UI is unable to connect to the back-end API. Please test the connection by clicking the button
          below to ensure the back-end service is running and accessible.
        </span>
        <br />
        <br />
        <span className="text-normal-accent">
          If the problem persists, please check our{' '}
          <a
            href="https://docs.glassflow.dev/getting-started/troubleshooting"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline"
          >
            troubleshooting guide
          </a>{' '}
          or contact support for assistance.
        </span>
      </p>

      <div className="w-full flex items-center justify-between">
        <div className="flex flex-col items-start gap-2">
          <span className="text-sm font-medium text-[var(--color-foreground-neutral-faded)]">Back-End Status</span>
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${isLoading ? 'bg-yellow-500 animate-pulse' : isConnected ? 'bg-green-500' : 'bg-red-500'
                }`}
            />
            <span className="text-sm font-medium">
              {isLoading ? 'Testing...' : isConnected ? 'Active' : 'Not Responding'}
            </span>
          </div>
        </div>

        <Button
          variant="primary"
          type="button"
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
