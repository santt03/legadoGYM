import { useState } from 'react'
import { ConfirmDialog } from './ConfirmDialog'

type PendingConfirmation = { title: string; description: string; resolve: (confirmed: boolean) => void }

export function useConfirmDialog() {
  const [pending, setPending] = useState<PendingConfirmation | null>(null)
  const confirm = (title: string, description: string) => new Promise<boolean>((resolve) => setPending({ title, description, resolve }))
  const close = (confirmed: boolean) => {
    pending?.resolve(confirmed)
    setPending(null)
  }
  return {
    confirm,
    dialog: pending && <ConfirmDialog title={pending.title} description={pending.description} onCancel={() => close(false)} onConfirm={() => close(true)} />,
  }
}
