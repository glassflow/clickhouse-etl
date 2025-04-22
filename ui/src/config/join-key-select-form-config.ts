import { TIME_WINDOW_UNIT_OPTIONS } from './constants'

// Define the form configuration
export const JoinKeySelectFormConfig = {
  joinKeySelector: {
    fields: {
      'streams.0.streamId': {
        name: 'streams.0.streamId',
        label: 'Stream ID',
        placeholder: 'Auto-generated stream ID',
        type: 'text',
        required: 'Stream ID is required',
        readOnly: true,
        className: 'bg-gray-100 cursor-not-allowed',
      },
      'streams.0.joinKey': {
        name: 'streams.0.joinKey',
        label: 'Join Key',
        placeholder: 'Select...',
        type: 'select',
        required: 'Join key is required',
      },
      'streams.0.dataType': {
        name: 'streams.0.dataType',
        label: 'Data Type',
        placeholder: 'Select...',
        type: 'select',
        required: 'Data type is required',
      },
      'streams.0.joinTimeWindowValue': {
        name: 'streams.0.joinTimeWindowValue',
        label: '',
        placeholder: 'Select...',
        type: 'number',
        required: 'Time window value is required',
        valueAsNumber: true,
      },
      'streams.0.joinTimeWindowUnit': {
        name: 'streams.0.joinTimeWindowUnit',
        label: '',
        placeholder: 'Select...',
        type: 'select',
        options: Object.values(TIME_WINDOW_UNIT_OPTIONS).map((option) => ({
          label: option,
          value: option,
        })),
      },

      'streams.1.streamId': {
        name: 'streams.1.streamId',
        label: 'Stream ID',
        placeholder: 'Auto-generated stream ID',
        type: 'text',
        required: 'Stream ID is required',
        readOnly: true,
        className: 'bg-gray-100 cursor-not-allowed',
      },
      'streams.1.joinKey': {
        name: 'streams.1.joinKey',
        label: 'Join Key',
        placeholder: 'Select...',
        type: 'select',
        required: 'Join key is required',
      },
      'streams.1.dataType': {
        name: 'streams.1.dataType',
        label: 'Data Type',
        placeholder: 'Select...',
        type: 'select',
        required: 'Data type is required',
      },
      'streams.1.joinTimeWindowValue': {
        name: 'streams.1.joinTimeWindowValue',
        label: '',
        placeholder: 'Select...',
        type: 'number',
        required: 'Time window value is required',
        valueAsNumber: true,
      },
      'streams.1.joinTimeWindowUnit': {
        name: 'streams.1.joinTimeWindowUnit',
        label: '',
        placeholder: 'Select...',
        type: 'select',
        options: Object.values(TIME_WINDOW_UNIT_OPTIONS).map((option) => ({
          label: option,
          value: option,
        })),
      },
    },
  },
}
