'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Button } from '@/src/components/ui/button'
import AngryIcon from '@/assets/icons/angry.svg'
import AngryIconSelected from '@/assets/icons/angry-selected.svg'
import FrownIcon from '@/assets/icons/frown.svg'
import FrownIconSelected from '@/assets/icons/frown-selected.svg'
import MehIcon from '@/assets/icons/meh.svg'
import MehIconSelected from '@/assets/icons/meh-selected.svg'
import SmileIcon from '@/assets/icons/smile.svg'
import SmileIconSelected from '@/assets/icons/smile-selected.svg'
import LaughIcon from '@/assets/icons/laugh.svg'
import LaughIconSelected from '@/assets/icons/laugh-selected.svg'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'

type FeedbackType = 'angry' | 'frown' | 'meh' | 'smile' | 'laugh' | null

const FEEDBACK_SUBMITTED_KEY = 'glassflow-feedback-submitted'
const FEEDBACK_DELAY_MS = 1000 // 1 second delay

export const Feedback = () => {
  const analytics = useJourneyAnalytics()
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackType>(null)
  const [feedbackText, setFeedbackText] = useState('')
  const [hasSubmittedFeedback, setHasSubmittedFeedback] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const isNegativeFeedback = selectedFeedback === 'angry' || selectedFeedback === 'frown' || selectedFeedback === 'meh'

  // Check if feedback was already submitted
  useEffect(() => {
    const feedbackSubmitted = localStorage.getItem(FEEDBACK_SUBMITTED_KEY)
    if (feedbackSubmitted === 'true') {
      setHasSubmittedFeedback(true)
    }

    // Track page view when component loads
    analytics.page.pipelines({})
  }, [])

  // Handle showing feedback with delay and status check
  useEffect(() => {
    let timeoutId: NodeJS.Timeout

    const shouldShowFeedback = () => {
      return !hasSubmittedFeedback && (status === 'active' || status === 'deploy_failed' || status === 'delete_failed')
    }

    if (shouldShowFeedback()) {
      timeoutId = setTimeout(() => {
        setShowFeedback(true)
      }, FEEDBACK_DELAY_MS)
    } else {
      setShowFeedback(false)
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [status, hasSubmittedFeedback])

  const handleFeedbackSelect = (feedback: FeedbackType) => {
    setSelectedFeedback(feedback)
  }

  const handleFeedbackSubmit = () => {
    // Store feedback submission in localStorage
    localStorage.setItem(FEEDBACK_SUBMITTED_KEY, 'true')
    setHasSubmittedFeedback(true)

    // Reset form
    setSelectedFeedback(null)
    setFeedbackText('')
  }
  return showFeedback ? (
    <div
      className={`
            content-card cursor-pointer group min-w-[480px] mt-16 
            transition-all duration-500 ease-out
            transform translate-y-0 opacity-100
            ${isNegativeFeedback ? 'min-h-[400px]' : 'min-h-[120px]'}
            animate-feedback-entrance
          `}
    >
      <div className="flex flex-col items-center justify-center w-full p-8">
        <h1 className="text-lg font-medium">How was your experience?</h1>
        <div className="flex items-center justify-center w-full gap-2 my-4">
          <button
            onClick={() => handleFeedbackSelect('angry')}
            className={`p-2 transition-all ${selectedFeedback === 'angry' ? 'text-[var(--primary)]' : 'text-gray-400'}`}
          >
            <Image
              src={selectedFeedback === 'angry' ? AngryIconSelected : AngryIcon}
              alt="Angry"
              width={32}
              height={32}
              className="transition-opacity duration-200"
            />
          </button>
          <button
            onClick={() => handleFeedbackSelect('frown')}
            className={`p-2 transition-all ${selectedFeedback === 'frown' ? 'text-[var(--primary)]' : 'text-gray-400'}`}
          >
            <Image
              src={selectedFeedback === 'frown' ? FrownIconSelected : FrownIcon}
              alt="Frown"
              width={32}
              height={32}
              className="transition-opacity duration-200"
            />
          </button>
          <button
            onClick={() => handleFeedbackSelect('meh')}
            className={`p-2 transition-all ${selectedFeedback === 'meh' ? 'text-[var(--primary)]' : 'text-gray-400'}`}
          >
            <Image
              src={selectedFeedback === 'meh' ? MehIconSelected : MehIcon}
              alt="Meh"
              width={32}
              height={32}
              className="transition-opacity duration-200"
            />
          </button>
          <button
            onClick={() => handleFeedbackSelect('smile')}
            className={`p-2 transition-all ${selectedFeedback === 'smile' ? 'text-[var(--primary)]' : 'text-gray-400'}`}
          >
            <Image
              src={selectedFeedback === 'smile' ? SmileIconSelected : SmileIcon}
              alt="Smile"
              width={32}
              height={32}
              className="transition-opacity duration-200"
            />
          </button>
          <button
            onClick={() => handleFeedbackSelect('laugh')}
            className={`p-2 transition-all ${selectedFeedback === 'laugh' ? 'text-[var(--primary)]' : 'text-gray-400'}`}
          >
            <Image
              src={selectedFeedback === 'laugh' ? LaughIconSelected : LaughIcon}
              alt="Laugh"
              width={32}
              height={32}
              className="transition-opacity duration-200"
            />
          </button>
        </div>
        <div
          className={`w-full transition-all duration-300 ease-in-out ${isNegativeFeedback ? 'opacity-100 max-h-[200px]' : 'opacity-0 max-h-0 overflow-hidden'}`}
        >
          <textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value.slice(0, 1000))}
            placeholder="Please tell us what we can improve..."
            maxLength={1000}
            className="w-full p-3 rounded-md border border-[var(--color-border-regular)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] min-h-[180px] resize-none bg-[var(--color-background)] text-[var(--color-content)]"
          />
          <div className="text-sm text-gray-500 mt-1 text-left">{feedbackText.length}/1000 characters</div>
        </div>
        <div
          className={`flex items-center justify-end w-full mt-4 transition-all duration-300 ease-in-out ${isNegativeFeedback ? 'opacity-100' : 'opacity-0'}`}
        >
          <Button
            className="btn-primary btn-text"
            type="button"
            variant="gradient"
            size="custom"
            onClick={handleFeedbackSubmit}
            disabled={!selectedFeedback || (isNegativeFeedback && !feedbackText.trim())}
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  ) : null
}
