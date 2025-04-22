import { AUTH_OPTIONS, SECURITY_PROTOCOL_OPTIONS } from './constants'
import { INITIAL_OFFSET_OPTIONS } from './constants'

// Define the form configuration
export const TopicSelectorFormConfig = {
  topicSelector: {
    fields: {
      topicName: {
        name: 'topicName',
        label: 'Source Topic',
        placeholder: 'Select a topic',
        type: 'select',
        required: 'Topic is required',
      },
      initialOffset: {
        name: 'initialOffset',
        label: 'Initial Offset',
        placeholder: 'Select initial offset',
        type: 'select',
        options: Object.entries(INITIAL_OFFSET_OPTIONS).map(([key, value]) => ({
          label: value,
          value: value,
        })),
        required: 'Initial offset is required',
      },
    },
  },
}
