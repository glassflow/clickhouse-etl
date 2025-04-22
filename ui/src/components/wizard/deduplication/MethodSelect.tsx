import { Label } from '@/src/components/ui/label'
import { SelectValue } from '@/src/components/ui/select'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/src/components/ui/select'

export function MethodSelect({ method, setMethod }: { method: string; setMethod: (method: string) => void }) {
  return (
    <div className="space-y-2">
      <Label htmlFor="dedup-method">Deduplication Method</Label>
      <Select value={method} onValueChange={setMethod}>
        <SelectTrigger id="dedup-method">
          <SelectValue placeholder="Select method" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="first_win">First Win</SelectItem>
          <SelectItem value="last_win">Last Win</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
