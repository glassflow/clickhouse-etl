import { Label } from '@/src/components/ui/label'
import { Switch } from '@/src/components/ui/switch'

export function EnableSwitch({ enabled, setEnabled }: { enabled: boolean; setEnabled: (enabled: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <Label htmlFor="dedup-toggle">Enable Deduplication</Label>
        <p className="text-sm text-muted-foreground">Automatically remove duplicate events from the stream</p>
      </div>
      <Switch id="dedup-toggle" checked={enabled} onCheckedChange={setEnabled} />
    </div>
  )
}
