import { Bell, Search } from 'lucide-react'
import type { Profile } from '@repo/types'

interface HeaderProps {
  user: Profile | null
}

export function Header({ user }: HeaderProps) {
  return (
    <header className="h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between px-6 shrink-0">
      {/* Search */}
      <div className="flex items-center gap-2 bg-muted/60 rounded-lg px-3 py-1.5 text-sm text-muted-foreground w-72">
        <Search className="h-4 w-4" />
        <span>بحث...</span>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        <button className="relative p-2 rounded-lg hover:bg-muted transition-colors">
          <Bell className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
            {user?.full_name?.[0] ?? '?'}
          </div>
          <div className="text-sm">
            <p className="font-medium leading-tight">{user?.full_name ?? 'المستخدم'}</p>
            <p className="text-xs text-muted-foreground leading-tight">
              {user?.role === 'admin' ? 'مدير النظام' :
               user?.role === 'manager' ? 'مدير عقارات' :
               user?.role === 'accountant' ? 'محاسب' :
               user?.role === 'maintenance' ? 'فريق الصيانة' : '—'}
            </p>
          </div>
        </div>
      </div>
    </header>
  )
}
