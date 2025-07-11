import React from 'react'

interface RestartIconProps {
  className?: string
  size?: number
}

export const RestartIcon: React.FC<RestartIconProps> = ({ className, size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M9.27273 3C9.66403 3 10.0114 3.24789 10.1352 3.61539L14.7273 17.2539L16.5921 11.7154C16.7158 11.3479 17.0632 11.1 17.4545 11.1H21.0909C21.593 11.1 22 11.5029 22 12C22 12.4971 21.593 12.9 21.0909 12.9H18.1098L15.5897 20.3846C15.466 20.7521 15.1186 21 14.7273 21C14.336 21 13.9886 20.7521 13.8648 20.3846L9.27273 6.74605L7.40789 12.2846C7.28415 12.6521 6.93675 12.9 6.54545 12.9H2.90909C2.40701 12.9 2 12.4971 2 12C2 11.5029 2.40701 11.1 2.90909 11.1H5.89022L8.41029 3.61539C8.53403 3.24789 8.88143 3 9.27273 3Z"
      fill="currentColor"
    />
  </svg>
)
