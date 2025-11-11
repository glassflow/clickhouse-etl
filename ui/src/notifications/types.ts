export type NotificationVariant = 'success' | 'info' | 'warning' | 'error'

export type NotificationChannel = 'toast' | 'banner' | 'modal' | 'inline'

export interface NotificationAction {
  label: string
  onClick: () => void
}

export interface NotificationOptions {
  variant: NotificationVariant
  title: string
  description?: string
  action?: NotificationAction
  reportLink?: string
  documentationLink?: string
  channel?: NotificationChannel
  duration?: number // For toast only (in milliseconds)
  persistent?: boolean // For banner/modal - prevents auto-dismiss
}

export interface BannerState {
  id: string
  options: NotificationOptions
  visible: boolean
}

export interface ModalState {
  id: string
  options: NotificationOptions
  visible: boolean
}

// Flash message structure for server actions
export interface FlashMessage {
  variant: NotificationVariant
  title: string
  description?: string
  action?: {
    label: string
    // Action is handled client-side, so we just store the label
  }
  reportLink?: string
  channel?: NotificationChannel
}
