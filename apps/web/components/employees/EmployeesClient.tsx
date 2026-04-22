'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  UserCheck, UserX, Clock, MoreHorizontal, Edit2, Power, PowerOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { InviteEmployeeDialog } from './InviteEmployeeDialog'
import { updateEmployeeRole, toggleEmployeeStatus } from '@/app/(dashboard)/dashboard/employees/actions'
import type { Employee, UserRole } from '@repo/types'

interface Props {
  employees: Employee[]
  companyId: string
}

const ROLE_LABELS: Record<string, string> = {
  admin:        'مدير عام',
  manager:      'مدير',
  accountant:   'محاسب',
  maintenance:  'فني صيانة',
  receptionist: 'موظف استقبال',
}

const ROLE_COLORS: Record<string, string> = {
  admin:        'bg-purple-100 text-purple-700',
  manager:      'bg-blue-100 text-blue-700',
  accountant:   'bg-green-100 text-green-700',
  maintenance:  'bg-orange-100 text-orange-700',
  receptionist: 'bg-teal-100 text-teal-700',
}

const INVITABLE_ROLES: { value: string; label: string }[] = [
  { value: 'manager',      label: 'مدير' },
  { value: 'accountant',   label: 'محاسب' },
  { value: 'maintenance',  label: 'فني صيانة' },
  { value: 'receptionist', label: 'موظف استقبال' },
]

export function EmployeesClient({ employees, companyId }: Props) {
  const [inviteOpen,   setInviteOpen]   = useState(false)
  const [editingId,    setEditingId]    = useState<string | null>(null)
  const [editingRole,  setEditingRole]  = useState<string>('')
  const [isPending,    startTransition] = useTransition()

  function handleRoleClick(emp: Employee) {
    setEditingId(emp.id)
    setEditingRole(emp.role)
  }

  function handleRoleSave(employeeId: string) {
    startTransition(async () => {
      const result = await updateEmployeeRole(employeeId, editingRole as UserRole)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('تم تحديث الدور')
        setEditingId(null)
      }
    })
  }

  function handleToggleStatus(emp: Employee) {
    startTransition(async () => {
      const result = await toggleEmployeeStatus(emp.id, emp.status)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(emp.status === 'active' ? 'تم تعطيل الموظف' : 'تم تفعيل الموظف')
      }
    })
  }

  const activeCount   = employees.filter(e => e.status === 'active'   && e.user_id).length
  const pendingCount  = employees.filter(e => !e.user_id).length
  const inactiveCount = employees.filter(e => e.status === 'inactive').length

  return (
    <div className="space-y-4">
      {/* Stats + Invite button */}
      <div className="flex items-center justify-between">
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span><span className="font-semibold text-foreground">{activeCount}</span> نشط</span>
          {pendingCount > 0 && (
            <span><span className="font-semibold text-amber-600">{pendingCount}</span> في انتظار القبول</span>
          )}
          {inactiveCount > 0 && (
            <span><span className="font-semibold text-muted-foreground">{inactiveCount}</span> غير نشط</span>
          )}
        </div>
        <Button onClick={() => setInviteOpen(true)} size="sm">
          <UserCheck className="h-4 w-4 ml-2" />
          دعوة موظف
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        {employees.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <UserCheck className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="font-medium text-muted-foreground">لا يوجد موظفون بعد</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              ادعُ أعضاء الفريق للبدء
            </p>
            <Button className="mt-4" size="sm" onClick={() => setInviteOpen(true)}>
              دعوة أول موظف
            </Button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">الموظف</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">الدور</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">الحالة</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">الهاتف</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {employees.map(emp => (
                <tr key={emp.id} className="hover:bg-muted/20 transition-colors">
                  {/* Name + Email */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                        {emp.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium">{emp.name}</p>
                        <p className="text-xs text-muted-foreground">{emp.email}</p>
                      </div>
                    </div>
                  </td>

                  {/* Role */}
                  <td className="px-4 py-3">
                    {editingId === emp.id ? (
                      <div className="flex items-center gap-2">
                        <Select
                          value={editingRole}
                          onValueChange={setEditingRole}
                        >
                          <SelectTrigger className="h-7 text-xs w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {INVITABLE_ROLES.map(r => (
                              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleRoleSave(emp.id)}
                          disabled={isPending}
                        >
                          حفظ
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => setEditingId(null)}
                        >
                          إلغاء
                        </Button>
                      </div>
                    ) : (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[emp.role] ?? 'bg-gray-100 text-gray-700'}`}>
                        {ROLE_LABELS[emp.role] ?? emp.role}
                      </span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    {!emp.user_id ? (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                        <Clock className="h-3 w-3" />
                        في انتظار القبول
                      </span>
                    ) : emp.status === 'active' ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                        <UserCheck className="h-3 w-3" />
                        نشط
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                        <UserX className="h-3 w-3" />
                        غير نشط
                      </span>
                    )}
                  </td>

                  {/* Phone */}
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {emp.phone ?? '—'}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        title="تعديل الدور"
                        onClick={() => handleRoleClick(emp)}
                        disabled={isPending}
                        className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      {emp.user_id && (
                        <button
                          title={emp.status === 'active' ? 'تعطيل' : 'تفعيل'}
                          onClick={() => handleToggleStatus(emp)}
                          disabled={isPending}
                          className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50"
                        >
                          {emp.status === 'active'
                            ? <PowerOff className="h-3.5 w-3.5 text-red-500" />
                            : <Power    className="h-3.5 w-3.5 text-green-500" />
                          }
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <InviteEmployeeDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        companyId={companyId}
      />
    </div>
  )
}
