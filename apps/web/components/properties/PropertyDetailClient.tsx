'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PropertyFormDialog } from './PropertyFormDialog'
import type { Property } from '@repo/types'

export function PropertyDetailClient({ property }: { property: Property }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="shrink-0">
        <Pencil className="h-4 w-4" />
        تعديل
      </Button>

      <PropertyFormDialog open={open} onOpenChange={setOpen} property={property} />
    </>
  )
}
