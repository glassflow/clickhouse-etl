import { z } from 'zod'

export const JoinConfigSchema = z.object({
  streams: z
    .array(
      z.object({
        streamId: z
          .string({
            required_error: 'Stream ID is required',
          })
          .min(1, 'Stream ID cannot be empty'),
        joinKey: z
          .string({
            required_error: 'Join key is required',
          })
          .min(1, 'Join key cannot be empty'),
        dataType: z
          .string({
            required_error: 'Data type is required',
          })
          .min(1, 'Type cannot be empty'),
        joinTimeWindowValue: z.coerce
          .number({
            required_error: 'Value is required',
            invalid_type_error: 'Value must be a number',
          })
          .min(1, 'Value must be greater than 0'),
        joinTimeWindowUnit: z
          .string({
            required_error: 'Unit is required',
          })
          .min(1, 'Unit cannot be empty'),
      }),
    )
    .length(2, 'Exactly two streams are required')
    .refine(
      (streams) => {
        return streams.every(
          (stream) =>
            stream.streamId &&
            stream.joinKey &&
            stream.dataType &&
            stream.joinTimeWindowValue &&
            stream.joinTimeWindowUnit,
        )
      },
      {
        message: 'All fields must be configured for both streams',
      },
    ),
})

export type JoinConfigType = z.infer<typeof JoinConfigSchema>
