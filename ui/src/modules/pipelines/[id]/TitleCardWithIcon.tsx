import { Card } from '@/src/components/ui/card'

function TitleCardWithIcon({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="border-[var(--color-border-neutral)] rounded-md p-6 h-48 flex flex-col items-center justify-center">
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="flex items-center justify-center">{children}</div>
        <h3 className="text-lg font-bold text-center">{title}</h3>
      </div>
    </Card>
  )
}

export default TitleCardWithIcon
