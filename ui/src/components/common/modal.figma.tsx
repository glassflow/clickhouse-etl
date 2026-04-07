import figma from '@figma/code-connect'
import { InfoModal } from '@/src/components/common/InfoModal'
import { ConfirmationModal } from '@/src/components/common/ConfirmationModal'

/**
 * Figma Code Connect — Modals
 *
 * HOW TO LINK:
 * 1. In Figma, select your Info Modal component → right-click → "Copy link to selection"
 *    → paste as FIGMA_INFO_MODAL_URL
 * 2. Do the same for your Confirmation Modal → paste as FIGMA_CONFIRMATION_MODAL_URL
 *
 * Both modals share the same visual shell (info-modal-container + surface-gradient-border).
 * InfoModal is the generic info/confirmation dialog.
 * ConfirmationModal adds a criticalOperation prop that switches the confirm button to destructive.
 */

// TODO: Replace with your Figma Info Modal component URL
const FIGMA_INFO_MODAL_URL =
  'https://www.figma.com/design/REPLACE_FILE_ID/REPLACE_FILE_NAME?node-id=REPLACE_NODE_ID_INFO'

// TODO: Replace with your Figma Confirmation Modal component URL
const FIGMA_CONFIRMATION_MODAL_URL =
  'https://www.figma.com/design/REPLACE_FILE_ID/REPLACE_FILE_NAME?node-id=REPLACE_NODE_ID_CONFIRM'

figma.connect(InfoModal, FIGMA_INFO_MODAL_URL, {
  props: {
    title: figma.string('Title'),
    description: figma.string('Description'),
    okButtonText: figma.string('OK Button'),
    cancelButtonText: figma.string('Cancel Button'),
    criticalOperation: figma.boolean('Critical'),
  },
  example: ({ title, description, okButtonText, cancelButtonText, criticalOperation }) => (
    <InfoModal
      visible={true}
      title={title}
      description={description}
      okButtonText={okButtonText}
      cancelButtonText={cancelButtonText}
      criticalOperation={criticalOperation}
      onComplete={() => {}}
    />
  ),
  imports: ["import { InfoModal } from '@/src/components/common/InfoModal'"],
})

figma.connect(ConfirmationModal, FIGMA_CONFIRMATION_MODAL_URL, {
  props: {
    title: figma.string('Title'),
    description: figma.string('Description'),
    okButtonText: figma.string('OK Button'),
    cancelButtonText: figma.string('Cancel Button'),
    criticalOperation: figma.boolean('Critical'),
  },
  example: ({ title, description, okButtonText, cancelButtonText, criticalOperation }) => (
    <ConfirmationModal
      visible={true}
      title={title}
      description={description}
      okButtonText={okButtonText}
      cancelButtonText={cancelButtonText}
      criticalOperation={criticalOperation}
      onComplete={() => {}}
    />
  ),
  imports: ["import { ConfirmationModal } from '@/src/components/common/ConfirmationModal'"],
})
