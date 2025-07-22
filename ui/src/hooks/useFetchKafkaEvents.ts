import { KafkaConnectionFormType } from '@/src/scheme'
import { KafkaStore } from '@/src/store/kafka.store'
import { useState } from 'react'

export const useFetchEvent = (kafka: KafkaStore, selectedFormat: string) => {
  const [isLoadingEvent, setIsLoadingEvent] = useState(false)
  const [eventError, setEventError] = useState<string | null>(null)
  const [event, setEvent] = useState<any>()
  const [currentOffset, setCurrentOffset] = useState<number | null>(null)
  const [hasMoreEvents, setHasMoreEvents] = useState(true)
  const [hasOlderEvents, setHasOlderEvents] = useState(false)

  const fetchEvent = async (
    topic: string,
    getNext: boolean = false,
    options?: {
      direction?: 'next' | 'previous'
      position?: 'earliest' | 'latest'
    },
  ) => {
    if (!topic) {
      setEventError('No topic specified')
      return
    }

    // Check edge cases before making the request
    if (options?.direction === 'previous' && currentOffset === null) {
      setEventError('Already at the first event')
      return
    }

    if (getNext && !hasMoreEvents) {
      setEventError('No more events available')
      return
    }

    setIsLoadingEvent(true)
    setEventError(null)

    const fetchTimeout = setTimeout(() => {
      if (isLoadingEvent) {
        setIsLoadingEvent(false)
        setEventError('Request timed out. Using sample data instead.')

        const mockData = {
          _mock: true,
          id: Math.floor(Math.random() * 10000),
          timestamp: new Date().toISOString(),
          topic: topic,
          data: {
            sample: `This is mock ${getNext ? 'next' : 'first'} data because the actual fetch timed out`,
            randomValue: Math.random(),
          },
          _offset: getNext && currentOffset ? parseInt(currentOffset.toString()) + 1 : 0,
        }

        setEvent(mockData as unknown as JSON)
        setCurrentOffset(getNext && currentOffset ? parseInt(currentOffset.toString()) + 1 : null)
      }
    }, 30000)

    try {
      // Base request body with common properties
      const requestBody: any = {
        servers: kafka.bootstrapServers,
        securityProtocol: kafka.securityProtocol,
        authMethod: kafka.authMethod,
        topic: topic,
        format: selectedFormat,
        runConsumerFirst: true,
      }

      // Add certificate if using SSL
      if (kafka.securityProtocol === 'SASL_SSL' || kafka.securityProtocol === 'SSL') {
        if (kafka.authMethod === 'SASL/SCRAM-256') {
          requestBody.certificate = kafka.saslScram256.certificate
        } else if (kafka.authMethod === 'SASL/SCRAM-512') {
          requestBody.certificate = kafka.saslScram512.certificate
        } else if (kafka.authMethod === 'SASL/PLAIN') {
          requestBody.certificate = kafka.saslPlain.certificate
        } else if (kafka.authMethod === 'NO_AUTH') {
          requestBody.certificate = kafka.noAuth.certificate
        } else {
          // TODO: handle this case more gracefully
        }
      }

      // Handle different fetch scenarios based on options
      if (options?.position === 'latest') {
        requestBody.position = 'latest'
        // When requesting latest, we know there are no more events after this
        // but there should be older events before it
        setHasMoreEvents(false)
        setHasOlderEvents(true)
      } else if (options?.position === 'earliest') {
        requestBody.position = 'earliest'
        // When requesting earliest, we know there are no older events before this
        // but there should be more events after it
        setHasMoreEvents(true)
        setHasOlderEvents(false)
      } else if (options?.direction === 'previous' && currentOffset !== null) {
        // For previous event, use the current offset and direction
        requestBody.direction = 'previous'
        requestBody.currentOffset = currentOffset
      } else if (getNext && currentOffset !== null) {
        // For next event
        requestBody.getNext = true
        requestBody.currentOffset = currentOffset
      } else {
        // Default case - initial fetch with no specific position
        console.log('Requesting initial event with no specific position')
      }

      // Add authentication details based on the auth method
      switch (kafka.authMethod) {
        case 'SASL/PLAIN':
          requestBody.username = kafka.saslPlain.username
          requestBody.password = kafka.saslPlain.password
          requestBody.consumerGroup = kafka.saslPlain.consumerGroup
          break

        case 'SASL/JAAS':
          requestBody.jaasConfig = kafka.saslJaas.jaasConfig
          break

        case 'SASL/GSSAPI':
          requestBody.kerberosPrincipal = kafka.saslGssapi.kerberosPrincipal
          requestBody.kerberosKeytab = kafka.saslGssapi.kerberosKeytab
          requestBody.kerberosRealm = kafka.saslGssapi.kerberosRealm
          requestBody.kdc = kafka.saslGssapi.kdc
          break

        case 'SASL/OAUTHBEARER':
          requestBody.oauthBearerToken = kafka.saslOauthbearer.oauthBearerToken
          break

        case 'SASL/SCRAM-256':
        case 'SASL/SCRAM-512':
          const scramValues = kafka.authMethod === 'SASL/SCRAM-256' ? kafka.saslScram256 : kafka.saslScram512
          requestBody.username = scramValues.username
          requestBody.password = scramValues.password
          requestBody.consumerGroup = scramValues.consumerGroup
          break

        case 'AWS_MSK_IAM':
          requestBody.awsRegion = kafka.awsIam.awsRegion
          requestBody.awsIAMRoleArn = kafka.awsIam.awsIAMRoleArn
          requestBody.awsAccessKey = kafka.awsIam.awsAccessKey
          requestBody.awsAccessKeySecret = kafka.awsIam.awsAccessKeySecret
          break

        case 'Delegation tokens':
          requestBody.delegationToken = kafka.delegationTokens.delegationToken
          break

        case 'SASL/LDAP':
          requestBody.ldapServerUrl = kafka.ldap.ldapServerUrl
          requestBody.ldapServerPort = kafka.ldap.ldapServerPort
          requestBody.ldapBindDn = kafka.ldap.ldapBindDn
          requestBody.ldapBindPassword = kafka.ldap.ldapBindPassword
          requestBody.ldapUserSearchFilter = kafka.ldap.ldapUserSearchFilter
          requestBody.ldapBaseDn = kafka.ldap.ldapBaseDn
          break

        case 'mTLS':
          requestBody.clientCert = kafka.mtls.clientCert
          requestBody.clientKey = kafka.mtls.clientKey
          requestBody.password = kafka.mtls.password
          break
      }

      // Add SSL-specific properties if using SSL
      // NOTE: This is not used in the current implementation
      // if (kafka.securityProtocol === 'SASL_SSL' || kafka.securityProtocol === 'SSL') {
      //   requestBody.truststore = kafka.truststore
      // }

      const response = await fetch('/api/kafka/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      clearTimeout(fetchTimeout)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      if (data.success) {
        setEvent(data.event)
        setIsLoadingEvent(false)

        // Extract the actual Kafka offset from the response
        const newOffset = data.offset ? parseInt(data.offset, 10) : null

        if (newOffset !== null) {
          // Update currentOffset with the actual Kafka offset
          setCurrentOffset(newOffset)

          // For position-based requests, respect the flags we set earlier
          if (!options?.position) {
            // Only update these flags for non-position requests
            if (data.metadata && data.metadata.hasOlderEvents !== undefined) {
              setHasOlderEvents(data.metadata.hasOlderEvents)
            } else if (options?.position !== 'earliest') {
              // Default to true for hasOlderEvents if not specified and not earliest
              setHasOlderEvents(true)
            }

            if (data.hasMoreEvents === false) {
              setHasMoreEvents(false)
            } else if (options?.position !== 'latest') {
              // Default to true for hasMoreEvents if not specified and not latest
              setHasMoreEvents(true)
            }
          }
        }

        if (data.isMock || data.event?._mock) {
          // If we got a mock event when trying to get the next event, it means we've reached the end
          if (getNext) {
            setHasMoreEvents(false)
            setEventError('No more events available')
          } else {
            setEventError('Note: Using sample data because actual data could not be fetched')
          }
        } else {
          setEventError(null)
        }
      } else {
        console.error('API returned error:', data.error)

        // Handle specific error cases
        if (data.error && (data.error.includes('end of topic') || data.error.includes('no more events'))) {
          setHasMoreEvents(false)
          setEventError('No more events available')
        } else if (data.error && data.error.includes('Timeout waiting for message')) {
          // Handle timeout errors specifically
          if (getNext) {
            setHasMoreEvents(false)
            setEventError('No more events available')
          } else if (options?.direction === 'previous') {
            setHasOlderEvents(false)
            setEventError('No previous events available')
          } else {
            setEventError(data.error || 'Failed to fetch event')
          }
        } else {
          setEventError(data.error || 'Failed to fetch event')
        }
      }
    } catch (error) {
      clearTimeout(fetchTimeout)

      console.error('Error fetching event:', error)

      // Handle specific error messages
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      if (errorMessage.includes('Timeout waiting for message')) {
        // Handle timeout errors specifically
        if (getNext) {
          setHasMoreEvents(false)
          setEventError('No more events available')
        } else if (options?.direction === 'previous') {
          setHasOlderEvents(false)
          setEventError('No previous events available')
        } else {
          setEventError(`Error: ${errorMessage}`)
        }
      } else {
        setEventError(`Error: ${errorMessage}`)
      }
    } finally {
      if (isLoadingEvent) {
        setIsLoadingEvent(false)
      }
    }
  }

  const resetEventState = () => {
    setEvent('')
    setEventError(null)
    setCurrentOffset(null)
    setHasMoreEvents(true)
    setHasOlderEvents(false)
  }

  return {
    fetchEvent,
    event,
    isLoadingEvent,
    eventError,
    hasMoreEvents,
    hasOlderEvents,
    resetEventState,
    currentOffset,
  }
}
