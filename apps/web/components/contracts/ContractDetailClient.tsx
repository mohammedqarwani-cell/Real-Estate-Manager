'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { terminateContract } from '@/app/(dashboard)/dashboard/contracts/actions'
import type { ContractStatus } from '@repo/types'

interface ContractDetailClientProps {
  contractId: string
  contractStatus: ContractStatus
}

export function ContractDetailClient({ contractId, contractStatus }: ContractDetailClientProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isPending, startTransition]  = useTransition()
  const router = useRouter()

  function handleTerminate() {
    startTransition(async () => {
      const result = await terminateContract(contractId)
      if (result.success) {
        toast.success('تم إنهاء العقد وتحديث حالة الوحدة إلى متاح')
        setConfirmOpen(false)
        router.refresh()
      } else {
        toast.error(result.error ?? 'حدث خطأ')
      }
    })
  }

  if (contractStatus !== 'active' && contractStatus !== 'draft') return null

  return (
    <>
      <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
        <XCircle className="h-4 w-4" />
        إنهاء العقد
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>تأكيد إنهاء العقد</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            هل أنت متأكد من إنهاء هذا العقد؟ سيتم تحديث حالة الوحدة إلى "متاح" تلقائياً. لا يمكن التراجع عن هذا الإجراء.
          </p>
          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={isPending}>
              إلغاء
            </Button>
            <Button variant="destructive" onClick={handleTerminate} disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              إنهاء العقد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
