'use client'

import React from 'react'
import Image from 'next/image'
import { StepKeys } from '@/src/config/constants'

// Import step-specific icons
import KafkaIcon from '@/src/images/kafka.svg'
import LeftTopicIcon from '@/src/images/left-topic.svg'
import RightTopicIcon from '@/src/images/right-topic.svg'
import DeduplicateIcon from '@/src/images/deduplicate.svg'
import JoinIcon from '@/src/images/join.svg'
import ClickhouseIcon from '@/src/images/clickhouse.svg'
import MapDestinationIcon from '@/src/images/map-destination.svg'
import IconCheck from '@/src/images/icon-check.svg'
import CheckPrimaryIcon from '@/src/images/check-primary.svg'

// Icon component type that can be rendered in the sidebar
export type StepIconComponent = React.FC<{ className?: string }>

// Create wrapper components for SVG icons to ensure consistent sizing
const createIconComponent = (
  SvgIcon: string,
  alt: string,
): StepIconComponent => {
  const IconComponent: StepIconComponent = ({ className }) => (
    <Image
      src={SvgIcon}
      alt={alt}
      width={18}
      height={18}
      className={className}
    />
  )
  IconComponent.displayName = `${alt}Icon`
  return IconComponent
}

// Define icon components for each step
export const stepIcons: Record<StepKeys, StepIconComponent> = {
  [StepKeys.KAFKA_CONNECTION]: createIconComponent(KafkaIcon, 'Kafka'),
  [StepKeys.TOPIC_SELECTION_1]: createIconComponent(LeftTopicIcon, 'Topic'),
  [StepKeys.TOPIC_SELECTION_2]: createIconComponent(RightTopicIcon, 'Right Topic'),
  [StepKeys.DEDUPLICATION_CONFIGURATOR]: createIconComponent(DeduplicateIcon, 'Deduplicate'),
  [StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1]: createIconComponent(LeftTopicIcon, 'Left Topic'),
  [StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2]: createIconComponent(RightTopicIcon, 'Right Topic'),
  [StepKeys.JOIN_CONFIGURATOR]: createIconComponent(JoinIcon, 'Join'),
  [StepKeys.CLICKHOUSE_CONNECTION]: createIconComponent(ClickhouseIcon, 'ClickHouse'),
  [StepKeys.CLICKHOUSE_MAPPER]: createIconComponent(MapDestinationIcon, 'Destination'),
  [StepKeys.REVIEW_CONFIGURATION]: createIconComponent(IconCheck, 'Review'),
  [StepKeys.DEPLOY_PIPELINE]: createIconComponent(IconCheck, 'Deploy'),
}

// Get icon component for a specific step
export const getStepIcon = (stepKey: StepKeys): StepIconComponent => {
  return stepIcons[stepKey]
}

// Completed state checkmark icon with primary color
export const CompletedCheckIcon: StepIconComponent = ({ className }) => (
  <Image
    src={CheckPrimaryIcon}
    alt="Completed"
    width={18}
    height={18}
    className={className}
  />
)

