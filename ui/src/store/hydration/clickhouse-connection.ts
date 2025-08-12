import { useStore } from '../index'

// Map backend pipeline config to ClickhouseConnectionFormType (store shape)
function mapBackendClickhouseConfigToStore(sink: any): any {
  return {
    connectionType: 'direct',
    directConnection: {
      host: sink.host || '',
      // Backend returns native port as sink.port; UI uses HTTP port for browsing
      httpPort: sink.http_port || '',
      username: sink.username || '',
      password: sink.password || '',
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
    console.log('hydrateClickhouseConnection', pipelineConfig.sink)
    const clickhouseConnection = mapBackendClickhouseConfigToStore(pipelineConfig.sink)
    useStore.getState().clickhouseConnectionStore.setClickhouseConnection(clickhouseConnection)
  }
}
