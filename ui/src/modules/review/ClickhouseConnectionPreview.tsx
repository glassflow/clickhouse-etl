import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'

// Helper function to render connection status
const renderConnectionStatus = (status: string | undefined) => {
  if (status === 'success') {
    return (
      <span className="flex items-center text-green-500">
        <CheckCircleIcon className="h-5 w-5 mr-1" />
        Connected
      </span>
    )
  } else if (status === 'error') {
    return (
      <span className="flex items-center text-red-500">
        <XCircleIcon className="h-5 w-5 mr-1" />
        Error
      </span>
    )
  }
  return <span className="text-gray-400">Not tested</span>
}

export function ClickhouseConnectionPreview({ clickhouseConnection }: { clickhouseConnection: any }) {
  if (!clickhouseConnection) return <div>Not configured</div>

  const { connectionType } = clickhouseConnection

  if (connectionType === 'direct') {
    const { directConnection } = clickhouseConnection
    return (
      <div className="grid grid-cols-2 gap-2">
        <div className="text-sm text-muted-foreground">Host:</div>
        <div>{directConnection?.host || 'Not configured'}</div>

        <div className="text-sm text-muted-foreground">HTTP(S) Port:</div>
        <div>{directConnection?.port || 'Not configured'}</div>

        <div className="text-sm text-muted-foreground">Native Port:</div>
        <div>{directConnection?.nativePort || 'Not configured'}</div>

        <div className="text-sm text-muted-foreground">Username:</div>
        <div>{directConnection?.username || 'Not configured'}</div>

        <div className="text-sm text-muted-foreground">SSL Enabled:</div>
        <div>{directConnection?.useSSL ? 'Yes' : 'No'}</div>

        <div className="text-sm text-muted-foreground">Connection Status:</div>
        <div>{renderConnectionStatus(clickhouseConnection.connectionStatus)}</div>
      </div>
    )
  } else if (connectionType === 'proxy') {
    const { proxyConnection } = clickhouseConnection
    return (
      <div className="grid grid-cols-2 gap-2">
        <div className="text-sm text-muted-foreground">Proxy URL:</div>
        <div>{proxyConnection?.proxyUrl || 'Not configured'}</div>

        <div className="text-sm text-muted-foreground">Connection Status:</div>
        <div>{renderConnectionStatus(clickhouseConnection.connectionStatus)}</div>
      </div>
    )
  } else if (connectionType === 'connectionString') {
    const { connectionString } = clickhouseConnection
    return (
      <div className="grid grid-cols-2 gap-2">
        <div className="text-sm text-muted-foreground">Connection String:</div>
        <div>********** (hidden for security)</div>

        <div className="text-sm text-muted-foreground">Connection Status:</div>
        <div>{renderConnectionStatus(clickhouseConnection.connectionStatus)}</div>
      </div>
    )
  }

  return <div>Unknown connection type</div>
}
