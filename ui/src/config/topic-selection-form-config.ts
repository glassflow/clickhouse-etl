import { INITIAL_OFFSET_OPTIONS } from './constants'

export const TopicSelectionFormConfig = {
  base: {
    fields: {
      topicName: {
        name: 'topicName',
        label: 'Topic',
        placeholder: 'Select topic',
        required: 'Topic is required',
        type: 'select',
      },
      initialOffset: {
        name: 'initialOffset',
        label: 'Initial Offset',
        placeholder: 'Select initial offset',
        required: 'Initial offset is required',
        type: 'select',
        options: Object.values(INITIAL_OFFSET_OPTIONS).map((option) => ({
          label: option,
          value: option,
        })),
      },
    },
  },
}
