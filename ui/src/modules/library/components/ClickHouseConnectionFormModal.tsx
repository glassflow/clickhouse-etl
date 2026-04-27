'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
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
import type { ClickhouseConnection } from '@/src/hooks/useLibraryConnections'

// ─── Validation schema ────────────────────────────────────────────────────────

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  tags: z.string().optional(),
  host: z.string().min(1, 'Host is required'),
  httpPort: z
    .string()
    .min(1, 'Port is required')
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, { message: 'Must be a valid port number' }),
  database: z.string().optional(),
  username: z.string().min(1, 'Username is required'),
  password: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

// ─── Props ────────────────────────────────────────────────────────────────────

type ClickHouseConnectionFormModalProps = {
  open: boolean
  onClose: () => void
  onSaved: () => void
  connection?: ClickhouseConnection | null
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ClickHouseConnectionFormModal({
  open,
  onClose,
  onSaved,
  connection,
}: ClickHouseConnectionFormModalProps) {
  const isEdit = !!connection

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      tags: '',
      host: '',
      httpPort: '8123',
      database: '',
      username: 'default',
      password: '',
    },
  })

  // Populate form when editing
  useEffect(() => {
    if (connection) {
      form.reset({
        name: connection.name,
        description: connection.description ?? '',
        tags: (connection.tags ?? []).join(', '),
        host: connection.config.host ?? '',
        httpPort: String(connection.config.httpPort ?? 8123),
        database: connection.config.database ?? '',
        username: connection.config.username ?? 'default',
        password: '', // never prefill password
      })
    } else {
      form.reset({
        name: '',
        description: '',
        tags: '',
        host: '',
        httpPort: '8123',
        database: '',
        username: 'default',
        password: '',
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

    const body = {
      name: values.name,
      description: values.description || null,
      tags,
      config: {
        host: values.host,
        httpPort: Number(values.httpPort),
        database: values.database || undefined,
        username: values.username,
        // Only include password in payload if one was entered (for edits, keep existing)
        ...(values.password ? { password: values.password } : {}),
      },
    }

    const url = isEdit
      ? `/ui-api/library/connections/clickhouse/${connection!.id}`
      : '/ui-api/library/connections/clickhouse'
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
            {isEdit ? 'Edit ClickHouse Connection' : 'Save ClickHouse Connection'}
          </DialogTitle>
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
                    <Input placeholder="e.g. Production ClickHouse" {...field} />
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

            {/* Host + Port row */}
            <div className="flex gap-3">
              <FormField
                control={form.control}
                name="host"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Host</FormLabel>
                    <FormControl>
                      <Input placeholder="clickhouse.example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="httpPort"
                render={({ field }) => (
                  <FormItem className="w-28">
                    <FormLabel>HTTP Port</FormLabel>
                    <FormControl>
                      <Input placeholder="8123" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Database */}
            <FormField
              control={form.control}
              name="database"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Database</FormLabel>
                  <FormControl>
                    <Input placeholder="default (optional)" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Username */}
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input placeholder="default" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Password */}
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password{isEdit && <span className="caption-1 text-[var(--text-secondary)] ml-1">(leave blank to keep existing)</span>}</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
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
                    <Input placeholder="production, analytics (comma-separated)" {...field} />
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
