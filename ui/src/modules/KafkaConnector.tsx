'use client'

import { KafkaConnectionForm } from '@/src/components/wizard/kafka/KafkaConnectionForm'
import { use, useEffect, useState, useRef } from 'react'
import { StepKeys } from '@/src/config/constants'
import { useStore } from '@/src/store'
import { useKafkaConnection } from '@/src/hooks/kafka-mng-hooks'

export function KafkaConnector({ steps, onNext }: { steps: any; onNext: (step: StepKeys) => void }) {
  const { kafkaStore, topicsStore } = useStore()
  const { bootstrapServers } = kafkaStore
  const { resetStore: resetTopicsStore } = topicsStore
  // ref to track previous bootstrap servers, not using state to avoid re-renders
  const previousBootstrapServers = useRef(bootstrapServers)

  const {
    testConnection,
    isConnecting,
    connectionResult,
    kafkaConnection: kafkaConnectionFromHook,
  } = useKafkaConnection()

  // Monitor changes to bootstrapServers
  useEffect(() => {
    if (previousBootstrapServers.current !== bootstrapServers) {
      // Source has changed, perform cleanup
      console.log('Kafka source changed from', previousBootstrapServers.current, 'to', bootstrapServers)

      resetTopicsStore()

      // Update the ref to track the new source
      previousBootstrapServers.current = bootstrapServers
    }
  }, [bootstrapServers])

  const handleTestConnection = async (values: any) => {
    console.log('args', values)
    await testConnection(values)
  }

  return (
    <>
      <KafkaConnectionForm
        // @ts-expect-error - FIXME: fix this later
        onTestConnection={handleTestConnection}
        isConnecting={isConnecting}
        connectionResult={connectionResult}
        onNext={onNext}
      />
      {connectionResult && (
        <div
          className={`mt-4 p-3 rounded ${connectionResult.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
        >
          {connectionResult.message}
        </div>
      )}
    </>
  )
}
