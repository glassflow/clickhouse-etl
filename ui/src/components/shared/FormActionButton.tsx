import { Button } from '../ui/button'
import { cn } from '@/src/utils/common.client'
import Loader from '@/src/images/loader-small.svg'
import Image from 'next/image'

function FormActionButton({
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
  className,
  actionType = 'primary',
  showLoadingIcon = false,
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
  className?: string
  actionType?: 'primary' | 'secondary' | 'tertiary' | 'destructive'
  showLoadingIcon?: boolean
}) {
  return (
    <Button
      size="custom"
      className={cn(className, isLoading && 'opacity-50')}
      type="button"
      variant={actionType === 'destructive' ? 'destructive' : actionType}
      onClick={onClick || (() => { })}
      disabled={disabled}
    >
      {isLoading && showLoadingIcon && (
        <Image src={Loader} alt="Loading" width={16} height={16} className="animate-spin" />
      )}
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

export default FormActionButton
