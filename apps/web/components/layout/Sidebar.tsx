'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Building2,
  Users,
  FileText,
  DollarSign,
  Wrench,
  CalendarCheck,
  BarChart2,
  Settings,
  LogOut,
  Zap,
  UserCheck,
} from 'lucide-react'
import { cn } from '@repo/ui'
import { useAuth } from '@/hooks/useAuth'
import type { UserRole, SubscriptionPlan } from '@repo/types'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  roles: UserRole[]
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/dashboard',
    label: 'لوحة التحكم',
    icon: LayoutDashboard,
    roles: ['admin', 'manager', 'accountant', 'maintenance', 'receptionist'],
  },
  {
    href: '/dashboard/properties',
    label: 'العقارات',
    icon: Building2,
    roles: ['admin', 'manager'],
  },
  {
    href: '/dashboard/tenants',
    label: 'المستأجرون',
    icon: Users,
    roles: ['admin', 'manager'],
  },
  {
    href: '/dashboard/contracts',
    label: 'العقود',
    icon: FileText,
    roles: ['admin', 'manager'],
  },
  {
    href: '/dashboard/invoices',
    label: 'الفواتير',
    icon: DollarSign,
    roles: ['admin', 'accountant'],
  },
  {
    href: '/dashboard/maintenance',
    label: 'الصيانة',
    icon: Wrench,
    roles: ['admin', 'maintenance'],
  },
  {
    href: '/dashboard/business-center',
    label: 'البزنس سنتر',
    icon: CalendarCheck,
    roles: ['admin', 'manager', 'receptionist'],
  },
  {
    href: '/dashboard/reports',
    label: 'التقارير',
    icon: BarChart2,
    roles: ['admin', 'manager', 'accountant'],
  },
  {
    href: '/dashboard/employees',
    label: 'الموظفون',
    icon: UserCheck,
    roles: ['admin'],
  },
]

interface SidebarProps {
  role: UserRole | null
  expiringContractsCount?: number
  overdueInvoicesCount?: number
  openMaintenanceCount?: number
  companyName?: string | null
  subscriptionPlan?: SubscriptionPlan
}

export function Sidebar({
  role,
  expiringContractsCount = 0,
  overdueInvoicesCount = 0,
  openMaintenanceCount = 0,
  companyName,
  subscriptionPlan = 'free',
}: SidebarProps) {
  const pathname = usePathname()
  const { signOut } = useAuth()

  const visibleItems = NAV_ITEMS.filter(item =>
    role ? item.roles.includes(role) : false
  )

  return (
    <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col shrink-0 h-full">
      {/* Logo + Company */}
      <div className="px-5 py-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="h-5 w-5 text-sidebar-primary shrink-0" />
          <span className="font-bold text-sm truncate">
            {companyName ?? 'إدارة العقارات'}
          </span>
        </div>
        {subscriptionPlan !== 'free' ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">
            <Zap className="h-2.5 w-2.5" />
            {subscriptionPlan === 'pro' ? 'احترافي' : 'مؤسسي'}
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground/60">الباقة المجانية</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visibleItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            pathname === href ||
            (href !== '/dashboard' && pathname.startsWith(href))
          const showContractsBadge    = href === '/dashboard/contracts'   && expiringContractsCount > 0
          const showInvoicesBadge     = href === '/dashboard/invoices'    && overdueInvoicesCount > 0
          const showMaintenanceBadge  = href === '/dashboard/maintenance' && openMaintenanceCount > 0
          const showBadge = showContractsBadge || showInvoicesBadge || showMaintenanceBadge
          const badgeCount = showContractsBadge
            ? expiringContractsCount
            : showInvoicesBadge
            ? overdueInvoicesCount
            : openMaintenanceCount
          const badgeClass = showInvoicesBadge
            ? 'bg-red-400 text-red-900'
            : showMaintenanceBadge
            ? 'bg-orange-400 text-orange-900'
            : 'bg-amber-400 text-amber-900'
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {showBadge && (
                <span className={`inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full text-[10px] font-bold ${badgeClass}`}>
                  {badgeCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-sidebar-border space-y-1">
        {role === 'admin' && (
          <>
            <Link
              href="/dashboard/settings/subscription"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            >
              <Zap className="h-4 w-4" />
              الاشتراك
              {subscriptionPlan === 'free' && (
                <span className="mr-auto text-[10px] bg-amber-400/20 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold">
                  ترقية
                </span>
              )}
            </Link>
            <Link
              href="/dashboard/settings"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            >
              <Settings className="h-4 w-4" />
              الإعدادات
            </Link>
          </>
        )}
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-destructive/20 hover:text-red-400 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          تسجيل الخروج
        </button>
      </div>
    </aside>
  )
}
