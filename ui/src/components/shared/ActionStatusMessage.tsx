import React, { useState, useEffect } from 'react'

function ActionStatusMessage({ message, success }: { message: string; success: boolean }) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Trigger animation after component mounts
    const timer = setTimeout(() => setIsVisible(true), 100)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="mt-4 overflow-hidden">
      <div
        className={`p-3 rounded transform transition-all duration-500 ease-out ${
          success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        } ${isVisible ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'}`}
      >
        {message}
      </div>
    </div>
  )
}

export default ActionStatusMessage
