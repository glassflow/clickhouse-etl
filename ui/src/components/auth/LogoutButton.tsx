'use client'

import { Button } from '@/src/components/ui/button'

interface LogoutButtonProps {
  logoutPath?: string
}

export default function LogoutButton({ logoutPath = '/api/auth/logout' }: LogoutButtonProps) {
  return (
    <Button asChild variant="ghost" size="sm">
      <a href={logoutPath}>Log Out</a>
    </Button>
  )
}
