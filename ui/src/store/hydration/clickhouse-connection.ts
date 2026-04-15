import { useStore } from '../index'

// Map backend pipeline config to ClickhouseConnectionFormType (store shape)
function mapBackendClickhouseConfigToStore(sink: any): any {
  // v3 format stores connection details nested under connection_params; v1/v2 use flat fields.
  const cp = sink.connection_params || {}
  const host = sink.host ?? cp.host ?? ''
  const httpPort = sink.http_port ?? cp.http_port ?? ''
  const nativePort = sink.port ?? cp.port ?? ''
  const username = sink.username ?? cp.username ?? ''
  const secure = sink.secure ?? cp.secure ?? true
  const skipCertVerification = sink.skip_certificate_verification ?? cp.skip_certificate_verification ?? false

  // The backend stores passwords as AES-encrypted+base64 and the API returns that same
  // encrypted value — the real plaintext is never exposed to the frontend. Attempting to
  // decode it would put the AES ciphertext into the form, which then gets re-submitted and
  // double-encrypted, corrupting the credential. Leave the password blank so the user is
  // prompted to re-enter it on edit.

  return {
    connectionType: 'direct',
    directConnection: {
      host,
      // Backend returns native port as sink.port; UI uses HTTP port for browsing
      httpPort,
      username,
      password: '',
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
