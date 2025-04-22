'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useStore } from '@/src/store'
import { StepKeys } from '@/src/config/constants'
import { Button } from '@/src/components/ui/button'
import { Card } from '@/src/components/ui/card'
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs'
import dynamic from 'next/dynamic'
import yaml from 'js-yaml'
import { v4 as uuidv4 } from 'uuid'
import { ClipboardIcon, CheckIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { InputModal, ModalResult } from '@/src/components/InputModal'
import { saveConfiguration } from '@/src/utils/storage'

interface ReviewConfigurationProps {
  steps: any
  onNext: (step: StepKeys) => void
  validate?: (step: StepKeys, data: any) => boolean
}

interface KafkaConnectionParams {
  brokers: string[]
  protocol: string
  mechanism?: string
  username?: string
  password?: string
  oauthBearerToken?: string
  root_ca?: string
}

// Update the dynamic import to match EventPreview
const AceEditor = dynamic(
  async () => {
    const ace = await import('react-ace')
    await import('ace-builds/src-noconflict/mode-json')
    await import('ace-builds/src-noconflict/mode-yaml')
    await import('ace-builds/src-noconflict/theme-github')
    // await import('ace-builds/src-noconflict/theme-dracula')
    await import('ace-builds/src-noconflict/theme-monokai')
    await import('ace-builds/src-noconflict/ext-language_tools')
    return ace
  },
  { ssr: false },
)

// Replace the EditorWrapper with a simpler pre-formatted code block
const CodeBlock = ({ value }: { value: string }) => {
  return (
    <div className="border rounded-md bg-gray-500 text-white overflow-auto" style={{ height: '500px' }}>
      <pre className="p-4 text-sm font-mono">{value}</pre>
    </div>
  )
}

// NOTE: temp hack - disable saving pipelines but leave the logic in place
const SAVE_PIPELINE_ENABLED = false

// Update the EditorWrapper component to be even more similar to EventPreview
const EditorWrapper = ({ mode, value }: { mode: string; value: string }) => {
  const [isFocused, setIsFocused] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)

      // Reset the copied state after 2 seconds
      setTimeout(() => {
        setCopied(false)
      }, 2000)
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }

  return (
    <div
      className="flex-grow relative w-full h-[800px] transition-all duration-200"
      style={{ border: '1px solid #333', borderRadius: '0.375rem', overflow: 'hidden' }}
    >
      {/* Copy button */}
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 z-10 p-2 bg-gray-800 hover:bg-gray-700 rounded-md text-white transition-all duration-200"
        title="Copy to clipboard"
      >
        {copied ? (
          <CheckIcon className="h-4 w-4 text-green-500 transition-colors duration-200" />
        ) : (
          <ClipboardIcon className="h-4 w-4 transition-colors duration-200" />
        )}
      </button>

      {AceEditor && (
        <AceEditor
          mode={mode}
          theme="dracula"
          name={`${mode}-editor`}
          value={value}
          readOnly={true}
          width="100%"
          height="100%"
          minLines={10}
          maxLines={Infinity}
          fontSize={14}
          showPrintMargin={false}
          showGutter={true}
          highlightActiveLine={true}
          setOptions={{
            useWorker: false,
            showPrintMargin: false,
            showGutter: true,
            highlightActiveLine: true,
            wrap: false,
            verticalScrollbarAlwaysVisible: true,
            horizontalScrollbarAlwaysVisible: true,
            fontSize: 14,
            tabSize: 2,
            showLineNumbers: true,
          }}
          editorProps={{ $blockScrolling: true }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={{ width: '100%', height: '100%' }}
        />
      )}
    </div>
  )
}

// Update the CSS styles to match EventPreview
const editorStyles = `
  .ace-editor-custom {
    font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
    line-height: 1.5;
  }
  .ace_editor {
    border-radius: 0.375rem;
  }
  .code-editor-container {
    border: 1px solid var(--border-color, #333);
    border-radius: 0.375rem;
    overflow: hidden;
  }
`

// Add this near the top of the file, after imports
const sectionStyles = `
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-section {
    animation: fadeInUp 0.5s ease-out forwards;
    opacity: 0;
  }

  .animate-section:nth-child(1) {
    animation-delay: 0.1s;
  }

  .animate-section:nth-child(2) {
    animation-delay: 0.2s;
  }

  .animate-section:nth-child(3) {
    animation-delay: 0.3s;
  }

  .animate-section:nth-child(4) {
    animation-delay: 0.4s;
  }
`

const encodeBase64 = (password: string) => {
  return password ? Buffer.from(password).toString('base64') : undefined
}

export function ReviewConfiguration({ steps, onNext, validate }: ReviewConfigurationProps) {
  const { kafkaStore, clickhouseStore, topicsStore, setApiConfig, pipelineId, setPipelineId } = useStore()
  const { clickhouseConnection, clickhouseDestination } = clickhouseStore
  const { bootstrapServers, securityProtocol } = kafkaStore
  const router = useRouter()
  const selectedTopics = Object.values(topicsStore.topics || {})

  // Add state for the modal
  const [isDeployModalVisible, setIsDeployModalVisible] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [jsonContent, setJsonContent] = useState('')
  const [yamlContent, setYamlContent] = useState('')
  const [apiConfigContent, setApiConfigContent] = useState('')

  // Generate API config without updating the store
  const generateApiConfig = () => {
    try {
      // Generate a new pipeline ID if one doesn't exist
      if (!pipelineId) {
        const newPipelineId = uuidv4()
        setPipelineId(newPipelineId)
      }

      // Map topics to the expected format
      const topicsConfig = selectedTopics.map((topic: any) => {
        return {
          consumer_group_initial_offset: topic.initialOffset,
          name: topic.name,
          id: topic.name, // Using topic name as id for now
          schema: {
            type: 'json',
            fields:
              topic.events &&
              topic.selectedEvent &&
              topic.selectedEvent.event &&
              typeof topic.selectedEvent.event === 'object'
                ? Object.keys(topic.selectedEvent.event.event || topic.selectedEvent.event).map((key) => {
                    // Try to infer type from the event data
                    const value = topic.selectedEvent.event[key]
                    let type = 'String' // Default type

                    if (typeof value === 'number') {
                      type = Number.isInteger(value) ? 'Int64' : 'Float64'
                    } else if (typeof value === 'boolean') {
                      type = 'Boolean'
                    } else if (value instanceof Date) {
                      type = 'DateTime'
                    } else if (Array.isArray(value)) {
                      type = 'Array(String)'
                    } else if (typeof value === 'object' && value !== null) {
                      type = 'Map(String, String)'
                    }

                    return {
                      name: key,
                      type: type,
                    }
                  })
                : [],
          },
          deduplication:
            topic.deduplication && topic.deduplication.enabled
              ? {
                  enabled: true,
                  id_field: topic.deduplication.method === 'key' ? topic.deduplication.keyField : undefined,
                  id_field_type: 'string', // Default to string type
                  time_window: topic.deduplication.window
                    ? `${topic.deduplication.window}${topic.deduplication.windowUnit?.charAt(0) || 'h'}`
                    : '1h',
                }
              : {
                  enabled: false,
                },
        }
      })

      // Create mapping for ClickHouse table
      const tableMappings = clickhouseDestination?.mapping
        ? clickhouseDestination.mapping
            .filter((mapping) => mapping.eventField) // Only include mapped fields
            .map((mapping) => {
              // Find which topic this field belongs to
              const sourceTopic = selectedTopics.find(
                (topic: any) =>
                  topic.events &&
                  topic.selectedEvent &&
                  topic.selectedEvent.event &&
                  mapping.eventField in topic.selectedEvent.event,
              )

              return {
                source_id: sourceTopic?.name || selectedTopics[0]?.name,
                field_name: mapping.eventField,
                column_name: mapping.name,
                column_type: mapping.type.replace(/Nullable\((.*)\)/, '$1'), // Remove Nullable wrapper
              }
            })
        : []

      // Build the complete API config
      const config = {
        pipeline_id: pipelineId,
        source: {
          type: 'kafka',
          provider: 'custom', // Or determine from connection details
          connection_params: {
            brokers: kafkaStore?.bootstrapServers?.split(',') || [],
            protocol: kafkaStore?.securityProtocol || 'PLAINTEXT',
          } as KafkaConnectionParams,
          topics: topicsConfig,
        },
        // Include join configuration if multiple topics
        ...(topicsConfig.length > 1
          ? {
              join: {
                enabled: true,
                type: 'temporal',
                sources: topicsConfig.map((topic) => ({
                  source_id: topic.name,
                  join_key: topic.deduplication?.id_field || 'id', // Use deduplication key or default
                  time_window: '1h',
                  orientation: 'left', // Default to left orientation
                })),
              },
            }
          : {}),
        sink: {
          type: 'clickhouse',
          provider: 'custom', // Or determine from connection details
          ...(clickhouseConnection?.connectionType === 'direct'
            ? {
                host: clickhouseConnection.directConnection?.host,
                // port: clickhouseConnection.directConnection?.port?.toString() || '8443',
                port: clickhouseConnection.directConnection?.nativePort?.toString() || '8443',
                database: clickhouseDestination?.database,
                username: clickhouseConnection.directConnection?.username,
                password: encodeBase64(clickhouseConnection.directConnection?.password),
                secure: true,
                // secure: clickhouseConnection.directConnection?.useSSL || false,
                max_batch_size: clickhouseDestination?.maxBatchSize || 1000,
                max_delay_time: `${clickhouseDestination?.maxDelayTime}${clickhouseDestination?.maxDelayTimeUnit}`,
              }
            : {}),
          table: clickhouseDestination?.table,
          table_mapping: tableMappings,
        },
      }

      // Add authentication parameters based on security protocol
      if (kafkaStore?.securityProtocol === 'SASL_PLAINTEXT' || kafkaStore?.securityProtocol === 'SASL_SSL') {
        const authMethod = kafkaStore.authMethod?.toLowerCase()

        if (authMethod?.includes('plain')) {
          config.source.connection_params = {
            ...config.source.connection_params,
            mechanism: 'PLAIN',
            username: kafkaStore.saslPlain?.username,
            password: encodeBase64(kafkaStore.saslPlain?.password),
          }
        } else if (authMethod?.includes('scram')) {
          const scramType = authMethod.includes('256') ? 'SCRAM-SHA-256' : 'SCRAM-SHA-512'
          const scramConfig = authMethod.includes('256') ? kafkaStore.saslScram256 : kafkaStore.saslScram512

          config.source.connection_params = {
            ...config.source.connection_params,
            mechanism: scramType,
            username: scramConfig?.username,
            password: encodeBase64(scramConfig?.password),
            root_ca: encodeBase64(kafkaStore.saslScram256?.certificate || kafkaStore.saslScram512?.certificate || ''),
          }
        } else if (authMethod?.includes('oauth')) {
          config.source.connection_params = {
            ...config.source.connection_params,
            mechanism: 'OAUTHBEARER',
            oauthBearerToken: kafkaStore.saslOauthbearer?.oauthBearerToken,
          }
        }

        // Add SSL certificate if using SSL
        if (kafkaStore?.securityProtocol === 'SASL_SSL' && kafkaStore.truststore?.certificates) {
          config.source.connection_params = {
            ...config.source.connection_params,
            root_ca: encodeBase64(kafkaStore.truststore.certificates),
          }
        }
      }

      return config
    } catch (error) {
      console.error('Error generating API config:', error)
      return { error: 'Failed to generate API configuration' }
    }
  }

  // Update the content when relevant store data changes
  useEffect(() => {
    const config = generateApiConfig()
    setJsonContent(JSON.stringify(config, null, 2))
    setYamlContent(yaml.dump(config, { indent: 2 }))
    setApiConfigContent(JSON.stringify(config, null, 2))
  }, [kafkaStore, clickhouseConnection, clickhouseDestination, selectedTopics])

  const handleFinishDeploymentStep = () => {
    if (validate && !validate(StepKeys.REVIEW_CONFIGURATION, {})) {
      return
    }

    if (SAVE_PIPELINE_ENABLED) {
      setIsDeployModalVisible(true)
    } else {
      handleDeployPipeline(ModalResult.SUBMIT, 'Pipeline', 'deploy')
    }
  }

  const handleDeployPipeline = (result: string, configName: string, operation: string) => {
    if (SAVE_PIPELINE_ENABLED) {
      setIsDeployModalVisible(false)

      // Save configuration to local storage if name is provided
      if (configName) {
        try {
          const savedConfig = saveConfiguration(
            configName,
            `Pipeline configuration saved on ${new Date().toLocaleString()}`,
          )
        } catch (error) {
          console.error('Failed to save configuration:', error)
          // You might want to show an error message to the user here
        }
      }
    }

    if (result === ModalResult.SUBMIT) {
      // Generate and set the API config before moving to the next step
      const config = generateApiConfig()
      setApiConfig(config)

      // Navigate to the pipelines page
      console.log('Navigating to /pipelines')
      router.push('/pipelines')
    }
  }

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

  // Safely render topics
  const renderTopics = () => {
    if (!selectedTopics || !Array.isArray(selectedTopics) || selectedTopics.length === 0) {
      return <li>No topics selected</li>
    }

    return selectedTopics.map((topic: any, index: number) => {
      // Handle different possible topic formats
      const topicName = typeof topic === 'string' ? topic : topic?.name || JSON.stringify(topic)

      return (
        <li key={index} className="mb-4">
          <div className="font-medium">{topicName}</div>
          {topic?.deduplication && (
            <div className="ml-4 mt-2 text-sm">
              <div>
                <span className="text-muted-foreground">Deduplication:</span>{' '}
                {topic.deduplication.enabled ? 'Enabled' : 'Disabled'}
              </div>
              {topic.deduplication.enabled && (
                <>
                  <div>
                    <span className="text-muted-foreground">Method:</span>{' '}
                    {topic.deduplication.method === 'key' ? 'Key-based' : 'Hash-based'}
                  </div>
                  {topic.deduplication.method === 'key' && (
                    <div>
                      <span className="text-muted-foreground">Key Field:</span>{' '}
                      {topic.deduplication.keyField || 'Not specified'}
                    </div>
                  )}
                  {topic.deduplication.window && (
                    <div>
                      <span className="text-muted-foreground">Time Window:</span> {topic.deduplication.window}{' '}
                      {topic.deduplication.windowUnit || 'seconds'}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </li>
      )
    })
  }

  // Render Kafka connection details based on security protocol
  const renderKafkaConnection = () => {
    if (!kafkaStore) return <div>Not configured</div>

    const { bootstrapServers, securityProtocol } = kafkaStore

    return (
      <div className="grid grid-cols-2 gap-2">
        <div className="text-sm text-muted-foreground">Bootstrap Servers:</div>
        <div>{bootstrapServers || 'Not configured'}</div>

        <div className="text-sm text-muted-foreground">Security Protocol:</div>
        <div>{securityProtocol || 'PLAINTEXT'}</div>

        {securityProtocol === 'SASL_PLAINTEXT' || securityProtocol === 'SASL_SSL' ? (
          <>
            <div className="text-sm text-muted-foreground">SASL Mechanism:</div>
            {/* @ts-expect-error - FIXME: fix this later */}
            <div>{kafkaStore.saslMechanism || 'Not configured'}</div>

            <div className="text-sm text-muted-foreground">Username:</div>
            {/* @ts-expect-error - FIXME: fix this later */}
            <div>{kafkaStore.username || 'Not configured'}</div>

            <div className="text-sm text-muted-foreground">Password:</div>
            <div>********** (hidden for security)</div>
          </>
        ) : null}

        {securityProtocol === 'SSL' || securityProtocol === 'SASL_SSL' ? (
          <>
            <div className="text-sm text-muted-foreground">SSL Verification:</div>
            {/* <div>{kafkaStore.sslVerification ? 'Enabled' : 'Disabled'}</div> */}

            {/* @ts-expect-error - FIXME: fix this later */}
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

  // Render Clickhouse connection details based on connection type
  const renderClickhouseConnection = () => {
    if (!clickhouseConnection) return <div>Not configured</div>

    const { connectionType } = clickhouseConnection

    if (connectionType === 'direct') {
      const { directConnection } = clickhouseConnection
      return (
        <div className="grid grid-cols-2 gap-2">
          <div className="text-sm text-muted-foreground">Host:</div>
          <div>{directConnection?.host || 'Not configured'}</div>

          <div className="text-sm text-muted-foreground">Port:</div>
          <div>{directConnection?.port || 'Not configured'}</div>

          <div className="text-sm text-muted-foreground">Username:</div>
          <div>{directConnection?.username || 'Not configured'}</div>

          <div className="text-sm text-muted-foreground">SSL Enabled:</div>
          <div>{directConnection?.useSSL ? 'Yes' : 'No'}</div>

          <div className="text-sm text-muted-foreground">Connection Status:</div>
          <div>{renderConnectionStatus(clickhouseConnection.connectionStatus)}</div>
        </div>
      )
    } else if (connectionType === 'proxy') {
      // @ts-expect-error - FIXME: fix this later
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
      // @ts-expect-error - FIXME: fix this later
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

  // Render Clickhouse destination details with expanded information
  const renderClickhouseDestination = () => {
    if (!clickhouseDestination) return <div>Not configured</div>

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="text-sm text-muted-foreground">Database:</div>
          <div className="text-sm text-content">{clickhouseDestination.database || 'Not configured'}</div>

          <div className="text-sm text-muted-foreground">Table:</div>
          <div className="text-sm text-content">{clickhouseDestination.table || 'Not configured'}</div>

          <div className="text-sm text-muted-foreground">Total Columns:</div>
          <div className="text-sm text-content">{clickhouseDestination.destinationColumns?.length || 0} columns</div>

          <div className="text-sm text-muted-foreground">Mapped Fields:</div>
          <div className="text-sm text-content">{clickhouseDestination.mapping?.length || 0} fields</div>

          <div className="text-sm text-muted-foreground">Max Batch Size:</div>
          <div className="text-sm text-content">{clickhouseDestination.maxBatchSize || '1000'} rows</div>

          <div className="text-sm text-muted-foreground">Max Delay Time:</div>
          <div className="text-sm text-content">
            {clickhouseDestination.maxDelayTime || '1'} {clickhouseDestination.maxDelayTimeUnit || 'm'}
          </div>
        </div>

        {clickhouseDestination.mapping && clickhouseDestination.mapping.length > 0 && (
          <div className="mt-4">
            <h4 className="text-md font-medium mb-2">Field Mappings</h4>
            <div className="bg-[var(--color-background-neutral-faded)] rounded-md p-2 overflow-auto max-h-[400px]">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 text-muted-foreground">Source Name</th>
                    <th className="text-left py-2 px-3 text-muted-foreground">Event Field</th>
                    <th className="text-left py-2 px-3 text-muted-foreground">→</th>
                    <th className="text-left py-2 px-3 text-muted-foreground">Destination Column</th>
                    <th className="text-left py-2 px-3 text-muted-foreground">Clickhouse Type</th>
                  </tr>
                </thead>
                <tbody>
                  {clickhouseDestination.mapping.map((mapping, index) => (
                    <tr
                      key={index}
                      className={index % 2 === 0 ? 'bg-transparent' : 'bg-[var(--color-background-neutral)]'}
                    >
                      <td className="py-2 px-3 text-content">
                        {selectedTopics.find(
                          (topic: any) =>
                            topic.events &&
                            topic.selectedEvent &&
                            topic.selectedEvent.event &&
                            mapping.eventField in topic.selectedEvent.event,
                        )?.name || 'Unknown'}
                      </td>
                      <td className="py-2 px-3 text-content">{mapping.eventField || 'Not mapped'}</td>
                      <td className="py-2 px-3 text-content">→</td>
                      <td className="py-2 px-3 text-content">{mapping.name}</td>
                      <td className="py-2 px-3 text-content">{mapping.type.replace(/Nullable\((.*)\)/, '$1')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Add this useEffect for styles
  useEffect(() => {
    const styleElement = document.createElement('style')
    styleElement.textContent = sectionStyles
    document.head.appendChild(styleElement)

    return () => {
      document.head.removeChild(styleElement)
    }
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-4 mb-4">
          <TabsTrigger
            value="overview"
            className="transition-all duration-200 hover:bg-[var(--color-background-neutral-faded)]"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="json"
            className="transition-all duration-200 hover:bg-[var(--color-background-neutral-faded)]"
          >
            JSON
          </TabsTrigger>
          <TabsTrigger
            value="yaml"
            className="transition-all duration-200 hover:bg-[var(--color-background-neutral-faded)]"
          >
            YAML
          </TabsTrigger>
          <TabsTrigger
            value="api"
            className="transition-all duration-200 hover:bg-[var(--color-background-neutral-faded)]"
          >
            API Config
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="p-4 border-b border-gray-200 last:border-b-0 transition-all duration-200 hover:bg-[var(--color-background-neutral-faded)] animate-section">
            <h3 className="text-lg font-medium mb-2 transition-colors duration-200">Kafka Connection</h3>
            {renderKafkaConnection()}
          </div>

          <div className="p-4 border-b border-gray-200 last:border-b-0 transition-all duration-200 hover:bg-[var(--color-background-neutral-faded)] animate-section">
            <h3 className="text-lg font-medium mb-2 transition-colors duration-200">Selected Topics</h3>
            <ul className="list-disc list-inside">{renderTopics()}</ul>
          </div>

          <div className="p-4 border-b border-gray-200 last:border-b-0 transition-all duration-200 hover:bg-[var(--color-background-neutral-faded)] animate-section">
            <h3 className="text-lg font-medium mb-2 transition-colors duration-200">Clickhouse Connection</h3>
            {renderClickhouseConnection()}
          </div>

          <div className="p-4 border-b border-gray-200 last:border-b-0 transition-all duration-200 hover:bg-[var(--color-background-neutral-faded)] animate-section">
            <h3 className="text-lg font-medium mb-2 transition-colors duration-200">Clickhouse Destination</h3>
            {renderClickhouseDestination()}
          </div>
        </TabsContent>

        <TabsContent value="json">
          <div className="p-4 transition-all duration-200 hover:bg-[var(--color-background-neutral-faded)] animate-section">
            <h3 className="text-lg font-medium mb-2 transition-colors duration-200">Configuration JSON</h3>
            <EditorWrapper mode="json" value={jsonContent} />
          </div>
        </TabsContent>

        <TabsContent value="yaml">
          <div className="p-4 transition-all duration-200 hover:bg-[var(--color-background-neutral-faded)] animate-section">
            <h3 className="text-lg font-medium mb-2 transition-colors duration-200">Configuration YAML</h3>
            <EditorWrapper mode="yaml" value={yamlContent} />
          </div>
        </TabsContent>

        <TabsContent value="api">
          <div className="p-4 transition-all duration-200 hover:bg-[var(--color-background-neutral-faded)] animate-section">
            <h3 className="text-lg font-medium mb-2 transition-colors duration-200">API Configuration</h3>
            <p className="text-sm text-muted-foreground mb-4 transition-colors duration-200">
              This is the configuration in the format expected by the API.
            </p>
            <EditorWrapper mode="json" value={apiConfigContent} />
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-start mt-4 animate-section">
        <Button
          className="btn-primary transition-all duration-200 hover:opacity-90"
          type="button"
          variant="gradient"
          size="custom"
          onClick={handleFinishDeploymentStep}
        >
          Deploy Pipeline
        </Button>
      </div>

      <InputModal
        visible={isDeployModalVisible}
        title="Deploy Pipeline"
        description="You can optionally save this configuration for future use."
        inputLabel="Configuration Name"
        inputPlaceholder="e.g., Production Pipeline v1"
        submitButtonText="Deploy"
        cancelButtonText="Cancel"
        onComplete={handleDeployPipeline}
        pendingOperation="deploy_pipeline"
        initialValue=""
        showSaveOption={true}
        validation={(value) => {
          if (!value.trim()) {
            return 'Configuration name is required'
          }
          if (value.length < 3) {
            return 'Configuration name must be at least 3 characters long'
          }
          return null
        }}
      />
    </div>
  )
}
