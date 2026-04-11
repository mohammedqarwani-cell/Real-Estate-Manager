'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Building2, MapPin, Plus, Search, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Property, PropertyType } from '@repo/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PropertyFormDialog } from './PropertyFormDialog'
import { deleteProperty } from '@/app/(dashboard)/dashboard/properties/actions'

// ─── Type Labels ──────────────────────────────────────────────────────────

const TYPE_LABELS: Record<PropertyType, string> = {
  residential: 'سكني',
  commercial: 'تجاري',
  business_center: 'بيزنس سنتر',
  mixed: 'مختلط',
}

const TYPE_COLORS: Record<PropertyType, string> = {
  residential: 'bg-blue-100 text-blue-700',
  commercial: 'bg-amber-100 text-amber-700',
  business_center: 'bg-purple-100 text-purple-700',
  mixed: 'bg-teal-100 text-teal-700',
}

// ─── Property Card ─────────────────────────────────────────────────────────

function PropertyCard({
  property,
  onEdit,
  onDelete,
}: {
  property: Property
  onEdit: (p: Property) => void
  onDelete: (p: Property) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="group relative rounded-xl border bg-card hover:shadow-md transition-shadow">
      {/* Image */}
      {property.images?.[0] ? (
        <div className="h-40 w-full overflow-hidden rounded-t-xl bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={property.images[0]}
            alt={property.name}
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <div className="h-40 w-full rounded-t-xl bg-muted flex items-center justify-center">
          <Building2 className="h-12 w-12 text-muted-foreground/30" />
        </div>
      )}

      {/* Actions menu */}
      <div className="absolute top-3 left-3">
        <div className="relative">
          <button
            onClick={(e) => { e.preventDefault(); setMenuOpen((v) => !v) }}
            className="rounded-md bg-black/30 p-1.5 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/50"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute left-0 top-8 z-20 min-w-[120px] rounded-md border bg-popover shadow-md py-1">
                <button
                  onClick={() => { setMenuOpen(false); onEdit(property) }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  تعديل
                </button>
                <button
                  onClick={() => { setMenuOpen(false); onDelete(property) }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  حذف
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Card content */}
      <Link href={`/dashboard/properties/${property.id}`} className="block p-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-base truncate">{property.name}</h3>
            <span
              className={`inline-flex items-center px-2 py-0.5 text-xs rounded-full mt-1 font-medium ${TYPE_COLORS[property.type]}`}
            >
              {TYPE_LABELS[property.type]}
            </span>
          </div>
          <span
            className={`shrink-0 text-xs px-2 py-1 rounded-full ${
              property.status === 'active'
                ? 'bg-green-100 text-green-700'
                : property.status === 'under_maintenance'
                ? 'bg-orange-100 text-orange-700'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {property.status === 'active'
              ? 'نشط'
              : property.status === 'under_maintenance'
              ? 'تحت الصيانة'
              : 'غير نشط'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{property.address}</span>
        </div>

        {property.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{property.description}</p>
        )}

        <div className="pt-2 border-t flex items-center justify-between text-sm">
          <span className="text-muted-foreground">إجمالي الوحدات</span>
          <span className="font-semibold">{property.total_units} وحدة</span>
        </div>
      </Link>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────

interface PropertiesClientProps {
  properties: Property[]
}

export function PropertiesClient({ properties }: PropertiesClientProps) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProperty, setEditingProperty] = useState<Property | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return properties.filter((p) => {
      const matchesType = typeFilter === 'all' || p.type === typeFilter
      const q = search.toLowerCase()
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q) ||
        (p.city ?? '').toLowerCase().includes(q)
      return matchesType && matchesSearch
    })
  }, [properties, search, typeFilter])

  function handleEdit(p: Property) {
    setEditingProperty(p)
    setDialogOpen(true)
  }

  function handleAdd() {
    setEditingProperty(null)
    setDialogOpen(true)
  }

  async function handleDelete(p: Property) {
    if (!confirm(`هل أنت متأكد من حذف "${p.name}"؟ سيتم حذف جميع البيانات المرتبطة به.`)) return
    setDeletingId(p.id)
    try {
      await deleteProperty(p.id)
      toast.success('تم حذف العقار بنجاح')
    } catch {
      toast.error('حدث خطأ أثناء حذف العقار')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">العقارات</h1>
          <p className="text-muted-foreground text-sm mt-1">إدارة جميع العقارات والمجمعات</p>
        </div>
        <Button onClick={handleAdd} className="shrink-0 self-start sm:self-auto">
          <Plus className="h-4 w-4" />
          إضافة عقار
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3" dir="rtl">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم أو الموقع..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="جميع الأنواع" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الأنواع</SelectItem>
            <SelectItem value="residential">سكني</SelectItem>
            <SelectItem value="commercial">تجاري</SelectItem>
            <SelectItem value="business_center">بيزنس سنتر</SelectItem>
            <SelectItem value="mixed">مختلط</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      {(search || typeFilter !== 'all') && (
        <p className="text-sm text-muted-foreground">
          {filtered.length === 0
            ? 'لا توجد نتائج مطابقة'
            : `${filtered.length} عقار من أصل ${properties.length}`}
        </p>
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Building2 className="h-16 w-16 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium">
            {properties.length === 0 ? 'لا توجد عقارات بعد' : 'لا توجد نتائج مطابقة'}
          </h3>
          <p className="text-muted-foreground text-sm mt-1">
            {properties.length === 0 ? 'ابدأ بإضافة أول عقار' : 'جرب تغيير معايير البحث'}
          </p>
          {properties.length === 0 && (
            <Button onClick={handleAdd} className="mt-4">
              <Plus className="h-4 w-4" />
              إضافة عقار
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <div key={p.id} className={deletingId === p.id ? 'opacity-50 pointer-events-none' : ''}>
              <PropertyCard
                property={p}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            </div>
          ))}
        </div>
      )}

      {/* Dialog */}
      <PropertyFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setEditingProperty(null)
        }}
        property={editingProperty}
      />
    </div>
  )
}
