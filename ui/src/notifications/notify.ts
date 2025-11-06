import { showToast } from './channels/toast'
import type { NotificationOptions } from './types'

// These will be set by the providers
let bannerContext: { showBanner: (options: NotificationOptions) => void } | null = null
let modalContext: { showModal: (options: NotificationOptions) => void } | null = null

export function setBannerContext(context: { showBanner: (options: NotificationOptions) => void }) {
  bannerContext = context
}

export function setModalContext(context: { showModal: (options: NotificationOptions) => void }) {
  modalContext = context
}

export function notify(options: NotificationOptions): string | number | React.ReactElement | void {
  const channel = options.channel || 'toast'

  switch (channel) {
    case 'toast':
      return showToast(options)

    case 'banner':
      if (!bannerContext) {
        console.warn('BannerProvider not found. Falling back to toast.')
        return showToast(options)
      }
      bannerContext.showBanner(options)
      return

    case 'modal':
      if (!modalContext) {
        console.warn('ModalProvider not found. Falling back to toast.')
        return showToast(options)
      }
      modalContext.showModal(options)
      return

    case 'inline':
      // For inline, we need to import dynamically since it returns JSX
      // This will be handled by the useNotify hook instead
      throw new Error(
        'Inline channel should be used with useNotify hook or InlineAlert component directly'
      )

    default:
      return showToast(options)
  }
}
