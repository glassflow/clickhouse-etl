export function KafkaConnectionPreview({ kafkaStore }: { kafkaStore: any }) {
  if (!kafkaStore) return <div>Not configured</div>

  const { bootstrapServers, securityProtocol } = kafkaStore

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
      <div className="text-sm text-muted-foreground">Bootstrap Servers:</div>
      <div>{bootstrapServers || 'Not configured'}</div>

      <div className="text-sm text-muted-foreground">Security Protocol:</div>
      <div>{securityProtocol || 'PLAINTEXT'}</div>

      {securityProtocol === 'SASL_PLAINTEXT' || securityProtocol === 'SASL_SSL' ? (
        <>
          <div className="text-sm text-muted-foreground">SASL Mechanism:</div>
          <div>{kafkaStore.saslMechanism || 'Not configured'}</div>

          <div className="text-sm text-muted-foreground">Username:</div>
          <div>{kafkaStore.username || 'Not configured'}</div>

          <div className="text-sm text-muted-foreground">Password:</div>
          <div>********** (hidden for security)</div>
        </>
      ) : null}

      {securityProtocol === 'SSL' || securityProtocol === 'SASL_SSL' ? (
        <>
          <div className="text-sm text-muted-foreground">SSL Verification:</div>
          {kafkaStore.sslCertificate && (
            <>
              <div className="text-sm text-muted-foreground">SSL Certificate:</div>
              <div>Certificate configured</div>
            </>
          )}
        </>
      ) : null}
    </div>
  )
}
