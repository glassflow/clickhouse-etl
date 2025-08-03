'use client'

import React from 'react'
import { KafkaTopicSelectorWithDraft } from '@/src/modules/kafka/KafkaTopicSelectorWithDraft'
import { StepKeys } from '@/src/config/constants'

export default function DraftTestPage() {
  const [currentStep, setCurrentStep] = React.useState<StepKeys>(StepKeys.TOPIC_SELECTION_1)
  const [readOnly, setReadOnly] = React.useState(false)

  const mockSteps = {
    [StepKeys.TOPIC_SELECTION_1]: {
      title: 'Topic Selection 1',
      component: KafkaTopicSelectorWithDraft,
    },
  }

  const handleCompleteStep = (stepKey: StepKeys) => {
    console.log('Step completed:', stepKey)
  }

  const handleCompleteStandaloneEditing = () => {
    console.log('Standalone editing completed')
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-4">Draft Mode Test Page</h1>

        <div className="flex gap-4 mb-4">
          <button
            onClick={() => setReadOnly(!readOnly)}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Toggle Read Only: {readOnly ? 'ON' : 'OFF'}
          </button>

          <button
            onClick={() => setCurrentStep(StepKeys.TOPIC_SELECTION_1)}
            className={`px-4 py-2 rounded ${
              currentStep === StepKeys.TOPIC_SELECTION_1 ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-700'
            }`}
          >
            Topic Selection 1
          </button>

          <button
            onClick={() => setCurrentStep(StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1)}
            className={`px-4 py-2 rounded ${
              currentStep === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1
                ? 'bg-green-500 text-white'
                : 'bg-gray-300 text-gray-700'
            }`}
          >
            Deduplication Configurator 1
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6">
        <KafkaTopicSelectorWithDraft
          steps={mockSteps}
          onCompleteStep={handleCompleteStep}
          validate={async () => true}
          currentStep={currentStep}
          readOnly={readOnly}
          standalone={true}
          toggleEditMode={true}
          enableDeduplication={currentStep === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1}
          onCompleteStandaloneEditing={handleCompleteStandaloneEditing}
          pipelineActionState={{ isLoading: false }}
        />
      </div>

      <div className="mt-6 p-4 bg-gray-100 rounded">
        <h2 className="text-lg font-semibold mb-2">Instructions:</h2>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li>Click "Edit" to enter draft mode</li>
          <li>Make changes to topic selection or deduplication</li>
          <li>Use "Save" to commit changes or "Discard" to revert</li>
          <li>Use "Reset" to clear all draft changes</li>
          <li>Toggle between different steps to test step-specific draft mode</li>
        </ul>
      </div>
    </div>
  )
}
