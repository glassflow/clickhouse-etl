import React from 'react'

interface CreateIconProps {
  className?: string
  size?: number
}

export const CreateIcon: React.FC<CreateIconProps> = ({ className, size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M7.99984 2.66797C8.36803 2.66797 8.6665 2.96645 8.6665 3.33464V7.33464H12.6665C13.0347 7.33464 13.3332 7.63311 13.3332 8.0013C13.3332 8.36949 13.0347 8.66797 12.6665 8.66797H8.6665V12.668C8.6665 13.0362 8.36803 13.3346 7.99984 13.3346C7.63165 13.3346 7.33317 13.0362 7.33317 12.668V8.66797H3.33317C2.96498 8.66797 2.6665 8.36949 2.6665 8.0013C2.6665 7.63311 2.96498 7.33464 3.33317 7.33464H7.33317V3.33464C7.33317 2.96645 7.63165 2.66797 7.99984 2.66797Z"
      fill="currentColor"
    />
  </svg>
)
