import { useStore } from '../index'

// Map backend pipeline config to ClickhouseConnectionFormType (store shape)
function mapBackendClickhouseConfigToStore(sink: any): any {
  // v3 format stores connection details nested under connection_params; v1/v2 use flat fields.
  const cp = sink.connection_params || {}
  const host = sink.host ?? cp.host ?? ''
  const httpPort = sink.http_port ?? cp.http_port ?? ''
  const nativePort = sink.port ?? cp.port ?? ''
  const username = sink.username ?? cp.username ?? ''
  const rawPassword = sink.password ?? cp.password ?? ''
  const secure = sink.secure ?? cp.secure ?? true
  const skipCertVerification = sink.skip_certificate_verification ?? cp.skip_certificate_verification ?? false

  // Decode base64 password if it's encoded
  let decodedPassword = rawPassword
  try {
    if (rawPassword && typeof rawPassword === 'string') {
      const decoded = atob(rawPassword)
      // If decoding succeeds and doesn't contain control characters, use decoded version
      if (decoded && !/[\x00-\x1F\x7F]/.test(decoded)) {
        decodedPassword = decoded
      }
    }
  } catch (error) {
    // If decoding fails, use original password (might not be base64 encoded)
    decodedPassword = rawPassword
  }

  return {
    connectionType: 'direct',
    directConnection: {
      host,
      // Backend returns native port as sink.port; UI uses HTTP port for browsing
      httpPort,
      username,
      password: decodedPassword,
      nativePort,
      useSSL: secure,
      skipCertificateVerification: skipCertVerification,
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
