'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
} from '@/src/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/src/components/ui/form'
import { Input } from '@/src/components/ui/input'
import { Button } from '@/src/components/ui/button'
import type { KafkaConnection } from '@/src/hooks/useLibraryConnections'

// ─── Validation schema ────────────────────────────────────────────────────────

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  tags: z.string().optional(), // comma-separated
  bootstrapServers: z.string().min(1, 'Bootstrap servers are required'),
  authMethod: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

// ─── Props ────────────────────────────────────────────────────────────────────

type KafkaConnectionFormModalProps = {
  open: boolean
  onClose: () => void
  onSaved: () => void
  connection?: KafkaConnection | null
}

// ─── Component ────────────────────────────────────────────────────────────────

export function KafkaConnectionFormModal({
  open,
  onClose,
  onSaved,
  connection,
}: KafkaConnectionFormModalProps) {
  const isEdit = !!connection

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      tags: '',
      bootstrapServers: '',
      authMethod: '',
    },
  })

  // Populate form when editing
  useEffect(() => {
    if (connection) {
      form.reset({
        name: connection.name,
        description: connection.description ?? '',
        tags: (connection.tags ?? []).join(', '),
        bootstrapServers: (connection.config.brokers ?? []).join(', '),
        authMethod: connection.config.authMethod ?? '',
      })
    } else {
      form.reset({
        name: '',
        description: '',
        tags: '',
        bootstrapServers: '',
        authMethod: '',
      })
    }
  }, [connection, form, open])

  const onSubmit = async (values: FormValues) => {
    const tags = values.tags
      ? values.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : []

    const brokers = values.bootstrapServers
      .split(',')
      .map((b) => b.trim())
      .filter(Boolean)

    const body = {
      name: values.name,
      description: values.description || null,
      tags,
      config: {
        brokers,
        authMethod: values.authMethod || undefined,
      },
    }

    const url = isEdit
      ? `/ui-api/library/connections/kafka/${connection!.id}`
      : '/ui-api/library/connections/kafka'
    const method = isEdit ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      onSaved()
      onClose()
    } else {
      const data = (await res.json()) as { error?: string }
      form.setError('root', {
        message: data.error ?? 'Failed to save connection',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogOverlay className="!fixed !inset-0 modal-overlay" aria-hidden="true" />
      <DialogContent className="info-modal-container surface-gradient-border border-0 sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="modal-title title-4 text-[var(--text-primary)]">
            {isEdit ? 'Edit Kafka Connection' : 'Save Kafka Connection'}
          </DialogTitle>
          <DialogDescription className="modal-description sr-only">
            {isEdit ? 'Edit the saved Kafka connection details.' : 'Fill in the details to save a new Kafka connection.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 mt-2">
            {/* Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Production Kafka" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input placeholder="Optional description" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Bootstrap Servers */}
            <FormField
              control={form.control}
              name="bootstrapServers"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bootstrap Servers</FormLabel>
                  <FormControl>
                    <Input placeholder="broker1:9092, broker2:9092" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Auth Method */}
            <FormField
              control={form.control}
              name="authMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Auth Method</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. PLAIN, SCRAM-SHA-256 (optional)" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Tags */}
            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags</FormLabel>
                  <FormControl>
                    <Input placeholder="production, kafka, streaming (comma-separated)" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Root error */}
            {form.formState.errors.root && (
              <p className="caption-1 text-[var(--color-foreground-critical)]">
                {form.formState.errors.root.message}
              </p>
            )}

            <DialogFooter className="mt-2">
              <Button variant="ghost" type="button" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                type="submit"
                loading={form.formState.isSubmitting}
                loadingText="Saving…"
              >
                {isEdit ? 'Save changes' : 'Save connection'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
