// NOTE: this component is not used atm, it's extracted from EventEditor

import { Label } from '@/src/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select'
import { EDITOR_THEMES } from '@/src/config/constants'

type ThemeSelectorProps = {
  editorTheme: string
  setEditorTheme: (theme: string) => void
}

export const ThemeSelector = ({ editorTheme, setEditorTheme }: ThemeSelectorProps) => {
  return (
    <div className="flex items-center justify-end mb-2">
      <div className="flex items-center">
        <Label htmlFor="theme-select" className="mr-2 text-sm">
          Editor Theme:
        </Label>
        <Select value={editorTheme} onValueChange={setEditorTheme}>
          <SelectTrigger className="w-[180px]" id="theme-select">
            <SelectValue placeholder="Select theme" />
          </SelectTrigger>
          <SelectContent>
            {EDITOR_THEMES.map((theme) => (
              <SelectItem key={theme.value} value={theme.value}>
                {theme.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
