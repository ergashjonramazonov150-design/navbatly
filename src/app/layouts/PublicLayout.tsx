import { Outlet } from 'react-router'

export function PublicLayout() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <Outlet />
    </div>
  )
}
