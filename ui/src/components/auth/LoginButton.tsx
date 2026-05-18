'use client'

import { Button } from '@/src/components/ui/button'

interface LoginButtonProps {
  loginPath?: string
}

export default function LoginButton({ loginPath = '/api/auth/login' }: LoginButtonProps) {
  return (
    <Button asChild type="button" variant="primary" size="custom" className="flex items-center gap-2">
      <a href={loginPath}>Log In / Sign Up</a>
    </Button>
  )
}
