'use client'

import { useMemo } from 'react'
import { useAuth } from './useAuth'
import type { UserRole } from '@repo/types'

export type PermissionResource =
  | 'properties'
  | 'tenants'
  | 'contracts'
  | 'invoices'
  | 'maintenance'
  | 'bookings'
  | 'employees'
  | 'reports'

type PermissionSet = {
  view: PermissionResource[]
  edit: PermissionResource[]
  delete: PermissionResource[]
}

const ROLE_PERMISSIONS: Record<UserRole, PermissionSet> = {
  admin: {
    view:   ['properties', 'tenants', 'contracts', 'invoices', 'maintenance', 'bookings', 'employees', 'reports'],
    edit:   ['properties', 'tenants', 'contracts', 'invoices', 'maintenance', 'bookings', 'employees'],
    delete: ['properties', 'tenants', 'contracts', 'invoices', 'maintenance', 'bookings', 'employees'],
  },
  manager: {
    view:   ['properties', 'tenants', 'contracts', 'maintenance', 'bookings', 'reports'],
    edit:   ['properties', 'tenants', 'contracts', 'maintenance', 'bookings'],
    delete: [],
  },
  accountant: {
    view:   ['invoices', 'reports'],
    edit:   ['invoices'],
    delete: [],
  },
  maintenance: {
    view:   ['maintenance'],
    edit:   ['maintenance'],
    delete: [],
  },
  receptionist: {
    view:   ['bookings'],
    edit:   ['bookings'],
    delete: [],
  },
}

export function usePermissions() {
  const { role } = useAuth()

  return useMemo(() => {
    const perms = role ? ROLE_PERMISSIONS[role] : { view: [], edit: [], delete: [] }

    return {
      canView:   (resource: PermissionResource) => perms.view.includes(resource),
      canEdit:   (resource: PermissionResource) => perms.edit.includes(resource),
      canDelete: (resource: PermissionResource) => perms.delete.includes(resource),
      role,
    }
  }, [role])
}
