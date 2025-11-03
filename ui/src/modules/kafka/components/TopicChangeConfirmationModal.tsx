import { ConfirmationModal, ModalResult } from '@/src/components/common/ConfirmationModal'

interface TopicChangeConfirmationModalProps {
  visible: boolean
  onOk: () => void
  onCancel: () => void
  newTopicName: string
  operationType?: 'ingest' | 'deduplication' | 'join' | 'deduplication-join'
}

function TopicChangeConfirmationModal({
  visible,
  onOk,
  onCancel,
  newTopicName,
  operationType = 'ingest',
}: TopicChangeConfirmationModalProps) {
  // Determine which sections will be invalidated based on operation type
  const getInvalidatedSections = () => {
    const sections: string[] = []

    switch (operationType) {
      case 'deduplication':
        sections.push('Deduplication Configuration')
        sections.push('Field Mapping')
        break
      case 'join':
        sections.push('Join Configuration')
        sections.push('Field Mapping')
        break
      case 'deduplication-join':
        sections.push('Deduplication Configuration')
        sections.push('Join Configuration')
        sections.push('Field Mapping')
        break
      case 'ingest':
      default:
        sections.push('Field Mapping')
        break
    }

    return sections
  }

  const invalidatedSections = getInvalidatedSections()

  const description = `<div>
    <div style="margin-bottom: 16px;">
      You are about to change the Kafka topic to <strong>"${newTopicName}"</strong>.
    </div>
    <div style="margin-bottom: 16px;">
      This will invalidate the following sections:
    </div>
    <ul style="margin-left: 20px; margin-bottom: 16px;">
      ${invalidatedSections.map((section) => `<li>${section}</li>`).join('')}
    </ul>
    <div style="margin-bottom: 16px;">
      These sections will show red borders and must be reconfigured with the new event schema.
    </div>
  </div>`

  return (
    <ConfirmationModal
      visible={visible}
      title="⚠️ Change Kafka Topic?"
      description={description}
      content={<div className="text-sm text-muted-foreground">Are you sure you want to change the topic?</div>}
      okButtonText="Change Topic"
      cancelButtonText="Cancel"
      onComplete={(result) => {
        if (result === ModalResult.YES) {
          onOk()
        } else {
          onCancel()
        }
      }}
      criticalOperation={false}
    />
  )
}

export default TopicChangeConfirmationModal
