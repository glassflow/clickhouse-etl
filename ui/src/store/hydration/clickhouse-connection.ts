import { useStore } from '../index'

// Map backend pipeline config to ClickhouseConnectionFormType (store shape)
function mapBackendClickhouseConfigToStore(sink: any): any {
  // Decode base64 password if it's encoded
  let decodedPassword = sink.password || ''
  try {
    // Check if password is base64 encoded by trying to decode it
    if (sink.password && typeof sink.password === 'string') {
      const decoded = atob(sink.password)
      // If decoding succeeds and doesn't contain control characters, use decoded version
      if (decoded && !/[\x00-\x1F\x7F]/.test(decoded)) {
        decodedPassword = decoded
      } else {
        console.log(
          'hydrateClickhouseConnection - password appears to be already decoded or contains control characters',
        )
      }
    }
  } catch (error) {
    // If decoding fails, use original password (might not be base64 encoded)
    decodedPassword = sink.password || ''
  }

  return {
    connectionType: 'direct',
    directConnection: {
      host: sink.host || '',
      // Backend returns native port as sink.port; UI uses HTTP port for browsing
      httpPort: sink.http_port || '',
      username: sink.username || '',
      password: decodedPassword,
      nativePort: sink.port || '',
      useSSL: sink.secure ?? true,
      skipCertificateVerification: sink.skip_certificate_verification || false,
    },
    connectionStatus: 'idle',
    connectionError: null,
  }
}

export function hydrateClickhouseConnection(pipelineConfig: any) {
  if (pipelineConfig?.sink) {
    const clickhouseConnection = mapBackendClickhouseConfigToStore(pipelineConfig.sink)
    useStore.getState().clickhouseConnectionStore.setClickhouseConnection(clickhouseConnection)
  }
}
