'use client'

import { useEffect, useRef, useState } from 'react'
import { Bell, Check, CheckCheck, X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ar } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import type { Notification } from '@repo/types'

// ── أيقونات حسب نوع الإشعار ──────────────────────────────────

const notificationConfig: Record<
  Notification['type'],
  { icon: string; color: string; bg: string }
> = {
  overdue_invoice:    { icon: '💸', color: 'text-red-600',    bg: 'bg-red-50' },
  expiring_contract:  { icon: '📋', color: 'text-orange-600', bg: 'bg-orange-50' },
  new_maintenance:    { icon: '🔧', color: 'text-blue-600',   bg: 'bg-blue-50' },
  new_booking:        { icon: '📅', color: 'text-green-600',  bg: 'bg-green-50' },
}

// ── Component ─────────────────────────────────────────────────

interface NotificationCenterProps {
  userId: string
}

export function NotificationCenter({ userId }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  const unreadCount = notifications.filter(n => !n.read).length

  // ── جلب الإشعارات الأولية ─────────────────────────────────

  async function fetchNotifications() {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (data) setNotifications(data as Notification[])
    setLoading(false)
  }

  // ── Supabase Realtime ─────────────────────────────────────

  useEffect(() => {
    fetchNotifications()

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotif = payload.new as Notification
          setNotifications(prev => [newNotif, ...prev].slice(0, 10))
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as Notification
          setNotifications(prev =>
            prev.map(n => (n.id === updated.id ? updated : n))
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // ── إغلاق الـ dropdown عند النقر خارجه ───────────────────

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  // ── تحديد إشعار كمقروء ───────────────────────────────────

  async function markAsRead(id: string) {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    )
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .eq('user_id', userId)
  }

  // ── تحديد الكل كمقروء ────────────────────────────────────

  async function markAllAsRead() {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id)
    if (unreadIds.length === 0) return

    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    await supabase
      .from('notifications')
      .update({ read: true })
      .in('id', unreadIds)
      .eq('user_id', userId)
  }

  // ── حذف إشعار ────────────────────────────────────────────

  async function deleteNotification(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setNotifications(prev => prev.filter(n => n.id !== id))
    await supabase
      .from('notifications')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
  }

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setOpen(prev => !prev)}
        className="relative p-2 rounded-lg hover:bg-muted transition-colors"
        aria-label="الإشعارات"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute left-0 top-full mt-2 w-80 bg-background border rounded-xl shadow-lg z-50 overflow-hidden"
          dir="rtl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
            <span className="font-semibold text-sm">الإشعارات</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                تحديد الكل كمقروء
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                جارٍ التحميل...
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center">
                <Bell className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">لا توجد إشعارات</p>
              </div>
            ) : (
              notifications.map(notif => {
                const config = notificationConfig[notif.type]
                return (
                  <div
                    key={notif.id}
                    onClick={() => !notif.read && markAsRead(notif.id)}
                    className={`
                      flex gap-3 px-4 py-3 border-b last:border-b-0 cursor-pointer
                      transition-colors hover:bg-muted/40 relative group
                      ${!notif.read ? 'bg-primary/5' : ''}
                    `}
                  >
                    {/* Icon */}
                    <div className={`shrink-0 w-9 h-9 rounded-full ${config.bg} flex items-center justify-center text-base mt-0.5`}>
                      {config.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-medium leading-tight ${!notif.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {notif.title}
                        </p>
                        {/* Delete button */}
                        <button
                          onClick={(e) => deleteNotification(notif.id, e)}
                          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
                        >
                          <X className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-2">
                        {notif.body}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] text-muted-foreground/70">
                          {formatDistanceToNow(new Date(notif.created_at), {
                            addSuffix: true,
                            locale: ar,
                          })}
                        </span>
                        {!notif.read && (
                          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                        )}
                        {notif.read && (
                          <Check className="h-3 w-3 text-muted-foreground/50" />
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t bg-muted/20 text-center">
              <span className="text-xs text-muted-foreground">
                آخر {notifications.length} إشعار
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
