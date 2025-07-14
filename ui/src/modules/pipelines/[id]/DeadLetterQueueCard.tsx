'use client'

import { Card } from '@/src/components/ui/card'
import DeadLetterQueueIcon from '@/src/images/dlq2.svg'
import MaximizeIcon from '@/src/images/maximize-2.svg'
import MinimizeIcon from '@/src/images/minimize-2.svg'
import Image from 'next/image'
import { useState } from 'react'

const dlqMetrics = {
  totalDlq: '1,546.899',
  lastEventReceived: '2 min. ago',
  unconsumedEvents: '1,546.899',
  lastConsumedAt: '2 min. ago',
}

const defaultMetrics = {
  totalDlq: '0',
  lastEventReceived: '-',
  unconsumedEvents: '0',
  lastConsumedAt: '-',
}

const renderMinimizedView = ({ unconsumedEvents }: { unconsumedEvents: string }) => {
  return (
    <div className="flex flex-row gap-2">
      <div className="flex flex-row gap-2">
        <div className="w-3 h-3 rounded-full bg-green-500 mt-2" />
        <span className="text-md font-bold">{dlqMetrics.unconsumedEvents || defaultMetrics.unconsumedEvents}</span>
        <span className="text-sm font-normal">Unconsumed events</span>
      </div>
    </div>
  )
}

const renderExpandedView = ({
  totalDlq,
  lastEventReceived,
  unconsumedEvents,
  lastConsumedAt,
}: {
  totalDlq: string
  lastEventReceived: string
  unconsumedEvents: string
  lastConsumedAt: string
}) => {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-row gap-2">
        <div className="w-3 h-3 rounded-full bg-green-500 mt-2 items-center" />
        <span className="text-md font-bold">{dlqMetrics.totalDlq || defaultMetrics.totalDlq}</span>
        <span className="text-sm font-normal">Total events in DLQ</span>
      </div>
      <div className="flex flex-row gap-2">
        <div className="w-3 h-3 rounded-full bg-green-500 mt-2 items-center" />
        <span className="text-md font-bold">{dlqMetrics.lastEventReceived || defaultMetrics.lastEventReceived}</span>
        <span className="text-sm font-normal">Last event received</span>
      </div>
      <div className="flex flex-row gap-2">
        <div className="w-3 h-3 rounded-full bg-green-500 mt-2" />
        <span className="text-md font-bold">{dlqMetrics.unconsumedEvents || defaultMetrics.unconsumedEvents}</span>
        <span className="text-sm font-normal">Unconsumed events</span>
      </div>
      <div className="flex flex-row gap-2">
        <div className="w-3 h-3 rounded-full bg-green-500 mt-2" />
        <span className="text-md font-bold">{dlqMetrics.lastConsumedAt || defaultMetrics.lastConsumedAt}</span>
        <span className="text-sm font-normal">Last consumed at</span>
      </div>
    </div>
  )
}

function DeadLetterQueueCard({ value, type }: { value: string; type: 'health' | 'metrics' }) {
  const [isExpanded, setIsExpanded] = useState(false)

  const toggleExpand = () => {
    setIsExpanded(!isExpanded)
  }

  return (
    <Card className="border-[var(--color-border-neutral)] rounded-md py-2 px-6 mb-4 w-2/3">
      <div className="flex flex-col gap-4">
        <div className="flex flex-row justify-between gap-2 items-center">
          <Image src={DeadLetterQueueIcon} alt="Dead Letter Queue" className="w-6 h-6" width={24} height={24} />
          <h3 className="text-lg font-bold">Dead Letter Queue</h3>
          <Image
            src={isExpanded ? MaximizeIcon : MinimizeIcon}
            alt="Maximize"
            className="w-6 h-6"
            width={24}
            height={24}
            onClick={toggleExpand}
          />
        </div>
        {isExpanded
          ? renderExpandedView(dlqMetrics)
          : renderMinimizedView({ unconsumedEvents: dlqMetrics.unconsumedEvents })}
      </div>
    </Card>
  )
}

export default DeadLetterQueueCard
