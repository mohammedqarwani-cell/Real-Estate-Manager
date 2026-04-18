'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, XCircle, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { terminateContract } from '@/app/(dashboard)/dashboard/contracts/actions'
import type { ContractStatus } from '@repo/types'
import type { ContractForPDF } from '@/components/pdf/ContractDocument'

interface ContractDetailClientProps {
  contractId: string
  contractStatus: ContractStatus
  contract?: ContractForPDF
}

export function ContractDetailClient({
  contractId,
  contractStatus,
  contract,
}: ContractDetailClientProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isPending, startTransition]  = useTransition()
  const [pdfLoading, setPdfLoading]   = useState(false)
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

  async function handlePrintPDF() {
    if (!contract) return
    setPdfLoading(true)
    try {
      const { generateContractPDF } = await import('@/components/pdf/generate')
      const blob = await generateContractPDF(contract)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `عقد-${contractId.slice(0, 8).toUpperCase()}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('PDF error:', err)
      toast.error('حدث خطأ أثناء توليد PDF')
    } finally {
      setPdfLoading(false)
    }
  }

  const canTerminate = contractStatus === 'active' || contractStatus === 'draft'

  return (
    <>
      <div className="flex items-center gap-2 self-start sm:self-auto">
        {contract && (
          <Button
            variant="outline"
            onClick={handlePrintPDF}
            disabled={pdfLoading}
            className="gap-2"
          >
            {pdfLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Printer className="h-4 w-4" />
            )}
            {pdfLoading ? 'جاري التحضير...' : 'طباعة العقد'}
          </Button>
        )}

        {canTerminate && (
          <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
            <XCircle className="h-4 w-4" />
            إنهاء العقد
          </Button>
        )}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>تأكيد إنهاء العقد</DialogTitle>
            <DialogDescription className="sr-only">
              تأكيد إنهاء العقد وتحديث حالة الوحدة
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            هل أنت متأكد من إنهاء هذا العقد؟ سيتم تحديث حالة الوحدة إلى "متاح" تلقائياً. لا يمكن
            التراجع عن هذا الإجراء.
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
