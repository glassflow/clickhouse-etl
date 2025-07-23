import { Button } from '../ui/button'
import { cn } from '@/src/utils/common.client'
import Loader from '@/src/images/loader-small.svg'
import Image from 'next/image'

function StepActionButton({
  children,
  isSuccess = false,
  isLoading = false,
  isFailed = false,
  disabled = false,
  onClick,
  successText = 'Success',
  failedText = 'Failed',
  loadingText = 'Loading...',
  regularText = 'Continue',
}: {
  children?: React.ReactNode
  isSuccess?: boolean
  isLoading?: boolean
  isFailed?: boolean
  disabled?: boolean
  onClick?: () => void
  successText?: string
  failedText?: string
  loadingText?: string
  regularText?: string
}) {
  return (
    <Button
      className={cn({
        'btn-primary': isSuccess,
        'btn-text': true,
        'opacity-50': isLoading,
      })}
      type="button"
      variant="gradient"
      size="custom"
      onClick={onClick || (() => {})}
      disabled={disabled}
    >
      {isLoading && <Image src={Loader} alt="Loading" width={16} height={16} className="animate-spin" />}
      {isLoading
        ? loadingText || 'Loading...'
        : isFailed !== undefined && isFailed
          ? failedText || 'Continue'
          : isSuccess !== undefined && isSuccess
            ? successText || 'Continue'
            : regularText || children}
    </Button>
  )
}

export default StepActionButton
