import { useStore } from '../index'

// Map backend pipeline config to ClickhouseConnectionFormType (store shape)
function mapBackendClickhouseConfigToStore(sink: any): any {
  return {
    connectionType: 'direct',
    directConnection: {
      host: sink.host || '',
      port: sink.port || '',
      username: sink.username || '',
      password: sink.password || '',
      nativePort: sink.native_port || sink.port || '',
      useSSL: sink.secure || true,
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
