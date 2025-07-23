'use client'

import React, { useState, useEffect } from 'react'
import {
  KafkaConnectionContainer,
  KafkaTopicSelector,
  DeduplicationConfigurator,
  ClickhouseConnectionContainer,
  ClickhouseMapper,
  TopicDeduplicationConfigurator,
} from '@/src/modules'
import { StepKeys } from '@/src/config/constants'
import { useStore } from '@/src/store'
import { JoinConfigurator } from './join/JoinConfigurator'

interface StepRendererPageComponentProps {
  children: React.ReactNode
  stepInfo: any
  handleBack: () => void
  onClose: () => void
}

function StepRendererPageComponent({ children, stepInfo, handleBack, onClose }: StepRendererPageComponentProps) {
  return (
    <div className="mt-6 w-full bg-[var(--color-background-elevation-raised-faded-2)] border border-[var(--color-border-neutral)] rounded-md animate-in fade-in slide-in-from-top-2 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b">
        <div>
          <h2 className="text-xl font-semibold">{stepInfo.title}</h2>
          <p className="text-sm text-gray-600">{stepInfo.description}</p>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">{children}</div>
    </div>
  )
}

export default StepRendererPageComponent
