import React from 'react'

interface EditIconProps {
  className?: string
  size?: number
}

export const EditIcon: React.FC<EditIconProps> = ({ className, size = 16 }) => (
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
      d="M12.1464 0.853553C12.3417 0.658291 12.6583 0.658291 12.8536 0.853553L15.1464 3.14645C15.3417 3.34171 15.3417 3.65829 15.1464 3.85355L6.14645 12.8536C6.06067 12.9393 5.95014 12.9899 5.83333 12.9982L1.83333 13.3315C1.57802 13.3473 1.35267 13.122 1.36852 12.8667L1.70185 8.86666C1.71007 8.74986 1.76074 8.63932 1.84645 8.55355L12.1464 0.853553ZM2.97099 9.19376L2.70549 12.2945L5.80624 12.029L13.9464 3.88889L12.1111 2.05355L2.97099 9.19376ZM14.6111 2.5L13.5 1.38889L14.6111 2.5Z"
      fill="currentColor"
    />
  </svg>
)
