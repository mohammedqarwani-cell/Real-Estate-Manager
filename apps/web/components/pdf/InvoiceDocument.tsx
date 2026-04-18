import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
// ─── Types ──────────────────────────────────────────────────────────────────

export type InvoiceForPDF = {
  id: string
  invoice_number: string
  type: string
  amount: number
  tax_amount: number
  total_amount: number
  due_date: string
  paid_date: string | null
  status: string
  payment_method: string | null
  notes: string | null
  created_at?: string
  tenant: {
    full_name: string
    email: string | null
    phone?: string | null
  } | null
  unit: {
    unit_number: string
    property?: { name: string } | null
  } | null
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const BLUE = '#1e40af'
const GREEN = '#15803d'

const s = StyleSheet.create({
  page: {
    fontFamily: 'Cairo',
    fontSize: 10,
    paddingTop: 40,
    paddingBottom: 70,
    paddingHorizontal: 50,
    backgroundColor: '#ffffff',
    lineHeight: 1.5,
  },
  // ── Header ──
  hdr: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    borderBottom: 2,
    borderBottomColor: BLUE,
    paddingBottom: 14,
  },
  hdrLeft: { alignItems: 'flex-start' },
  hdrRight: { alignItems: 'flex-end' },
  companyName: { fontSize: 16, fontWeight: 'bold', color: BLUE },
  companySubtitle: { fontSize: 9, color: '#64748b', marginTop: 2 },
  invoiceTitle: { fontSize: 22, fontWeight: 'bold', color: BLUE },
  invoiceNum: { fontSize: 10, color: '#475569', marginTop: 3 },
  // ── Status badge ──
  statusBadge: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginTop: 6,
    alignSelf: 'flex-end',
  },
  statusText: { fontSize: 9, fontWeight: 'bold' },
  // ── Info row ──
  infoSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 16,
  },
  infoBox: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 10,
  },
  infoBoxTitle: { fontSize: 9, fontWeight: 'bold', color: BLUE, textAlign: 'right', marginBottom: 6 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  infoLabel: { fontSize: 8.5, color: '#64748b', textAlign: 'right' },
  infoValue: { fontSize: 8.5, fontWeight: 'bold', color: '#0f172a', textAlign: 'right' },
  // ── Items table ──
  tableHdr: {
    flexDirection: 'row',
    backgroundColor: BLUE,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  tableHdrCell: { fontSize: 9, fontWeight: 'bold', color: '#ffffff', textAlign: 'right' },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderBottom: 1,
    borderBottomColor: '#e2e8f0',
  },
  tableRowAlt: { backgroundColor: '#f8fafc' },
  tableCell: { fontSize: 9, color: '#0f172a', textAlign: 'right' },
  tableCellGray: { fontSize: 9, color: '#64748b', textAlign: 'right' },
  // ── Totals ──
  totalsSection: {
    alignItems: 'flex-end',
    marginTop: 12,
    marginBottom: 20,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 4,
    width: '50%',
  },
  totalLabel: { fontSize: 9, color: '#64748b', flex: 1, textAlign: 'right' },
  totalValue: { fontSize: 9, color: '#0f172a', width: 100, textAlign: 'left' },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    backgroundColor: BLUE,
    paddingVertical: 6,
    paddingHorizontal: 10,
    width: '50%',
    marginTop: 4,
  },
  grandTotalLabel: { fontSize: 10, fontWeight: 'bold', color: '#ffffff', flex: 1, textAlign: 'right' },
  grandTotalValue: { fontSize: 10, fontWeight: 'bold', color: '#ffffff', width: 100, textAlign: 'left' },
  // ── Payment info ──
  paymentBox: {
    backgroundColor: '#f0fdf4',
    borderLeft: 3,
    borderLeftColor: GREEN,
    padding: 10,
    marginBottom: 16,
  },
  paymentTitle: { fontSize: 9.5, fontWeight: 'bold', color: GREEN, textAlign: 'right', marginBottom: 4 },
  paymentText: { fontSize: 9, color: '#166534', textAlign: 'right' },
  // ── Notes ──
  notesBox: {
    backgroundColor: '#fef9c3',
    padding: 8,
    marginBottom: 16,
  },
  notesTitle: { fontSize: 9, fontWeight: 'bold', color: '#92400e', textAlign: 'right', marginBottom: 3 },
  notesText: { fontSize: 8.5, color: '#78350f', textAlign: 'right', lineHeight: 1.6 },
  // ── Footer ──
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 50,
    right: 50,
    textAlign: 'center',
    fontSize: 7.5,
    color: '#94a3b8',
    borderTop: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 6,
  },
})

// ─── Constants ───────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  rent: 'إيجار شهري',
  maintenance: 'صيانة',
  utility: 'خدمات ومرافق',
  deposit: 'تأمين',
  other: 'متنوع',
}

const STATUS_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  draft:     { label: 'مسودة',          bg: '#f1f5f9', text: '#475569' },
  pending:   { label: 'معلقة',           bg: '#fef9c3', text: '#a16207' },
  paid:      { label: 'مدفوعة',         bg: '#dcfce7', text: '#15803d' },
  overdue:   { label: 'متأخرة',         bg: '#fee2e2', text: '#b91c1c' },
  partial:   { label: 'مدفوعة جزئياً', bg: '#ffedd5', text: '#c2410c' },
  cancelled: { label: 'ملغاة',          bg: '#f1f5f9', text: '#94a3b8' },
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'نقداً',
  bank_transfer: 'حوالة بنكية',
  cheque: 'شيك',
  card: 'بطاقة ائتمانية',
  online: 'دفع إلكتروني',
}

// ─── Main Document ────────────────────────────────────────────────────────────

export function InvoiceDocument({ invoice }: { invoice: InvoiceForPDF }) {
  const fmtDate = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString('ar-AE', { year: 'numeric', month: 'long', day: 'numeric' })
      : '—'
  const fmtAmt = (n: number) => `${n.toLocaleString('ar-AE')} د.إ`

  const statusCfg = STATUS_LABELS[invoice.status] ?? STATUS_LABELS['pending']
  const taxRate = invoice.amount > 0 ? (invoice.tax_amount / invoice.amount) * 100 : 0

  return (
    <Document title={`فاتورة ${invoice.invoice_number}`} author="نظام إدارة العقارات" language="ar">
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.hdr}>
          <View style={s.hdrLeft}>
            <Text style={s.companyName}>إدارة العقارات</Text>
            <Text style={s.companySubtitle}>نظام إدارة العقارات المتكامل</Text>
            <Text style={s.companySubtitle}>info@realestate.ae  |  www.realestate.ae</Text>
          </View>
          <View style={s.hdrRight}>
            <Text style={s.invoiceTitle}>فـاتورة</Text>
            <Text style={s.invoiceNum}>{invoice.invoice_number}</Text>
            <View style={[s.statusBadge, { backgroundColor: statusCfg.bg }]}>
              <Text style={[s.statusText, { color: statusCfg.text }]}>{statusCfg.label}</Text>
            </View>
          </View>
        </View>

        {/* Info boxes */}
        <View style={s.infoSection}>
          {/* Bill To */}
          <View style={s.infoBox}>
            <Text style={s.infoBoxTitle}>فاتورة إلى</Text>
            <View style={s.infoRow}>
              <Text style={s.infoValue}>{invoice.tenant?.full_name ?? '—'}</Text>
              <Text style={s.infoLabel}>المستأجر</Text>
            </View>
            {invoice.tenant?.phone && (
              <View style={s.infoRow}>
                <Text style={s.infoValue}>{invoice.tenant.phone}</Text>
                <Text style={s.infoLabel}>الهاتف</Text>
              </View>
            )}
            {invoice.tenant?.email && (
              <View style={s.infoRow}>
                <Text style={s.infoValue}>{invoice.tenant.email}</Text>
                <Text style={s.infoLabel}>البريد</Text>
              </View>
            )}
            {invoice.unit && (
              <View style={s.infoRow}>
                <Text style={s.infoValue}>
                  {(invoice.unit as any).property?.name ?? '—'} — وحدة {invoice.unit.unit_number}
                </Text>
                <Text style={s.infoLabel}>العقار / الوحدة</Text>
              </View>
            )}
          </View>

          {/* Invoice Details */}
          <View style={s.infoBox}>
            <Text style={s.infoBoxTitle}>تفاصيل الفاتورة</Text>
            <View style={s.infoRow}>
              <Text style={s.infoValue}>{invoice.invoice_number}</Text>
              <Text style={s.infoLabel}>رقم الفاتورة</Text>
            </View>
            <View style={s.infoRow}>
              <Text style={s.infoValue}>{invoice.created_at ? fmtDate(invoice.created_at) : '—'}</Text>
              <Text style={s.infoLabel}>تاريخ الإصدار</Text>
            </View>
            <View style={s.infoRow}>
              <Text style={s.infoValue}>{fmtDate(invoice.due_date)}</Text>
              <Text style={s.infoLabel}>تاريخ الاستحقاق</Text>
            </View>
            <View style={s.infoRow}>
              <Text style={s.infoValue}>{TYPE_LABELS[invoice.type] ?? invoice.type}</Text>
              <Text style={s.infoLabel}>نوع الفاتورة</Text>
            </View>
          </View>
        </View>

        {/* Items Table */}
        <View style={s.tableHdr}>
          <Text style={[s.tableHdrCell, { flex: 3 }]}>البيان</Text>
          <Text style={[s.tableHdrCell, { flex: 1 }]}>المبلغ</Text>
        </View>

        {/* Main item */}
        <View style={s.tableRow}>
          <Text style={[s.tableCell, { flex: 3 }]}>
            {TYPE_LABELS[invoice.type] ?? invoice.type}
            {invoice.unit ? ` — وحدة ${invoice.unit.unit_number}` : ''}
          </Text>
          <Text style={[s.tableCell, { flex: 1 }]}>{fmtAmt(invoice.amount)}</Text>
        </View>

        {/* Tax if applicable */}
        {invoice.tax_amount > 0 && (
          <View style={[s.tableRow, s.tableRowAlt]}>
            <Text style={[s.tableCellGray, { flex: 3 }]}>
              ضريبة القيمة المضافة ({taxRate.toFixed(0)}٪)
            </Text>
            <Text style={[s.tableCellGray, { flex: 1 }]}>{fmtAmt(invoice.tax_amount)}</Text>
          </View>
        )}

        {/* Totals */}
        <View style={s.totalsSection}>
          {invoice.tax_amount > 0 && (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>المجموع الجزئي</Text>
              <Text style={s.totalValue}>{fmtAmt(invoice.amount)}</Text>
            </View>
          )}
          {invoice.tax_amount > 0 && (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>الضريبة ({taxRate.toFixed(0)}٪)</Text>
              <Text style={s.totalValue}>{fmtAmt(invoice.tax_amount)}</Text>
            </View>
          )}
          <View style={s.grandTotalRow}>
            <Text style={s.grandTotalLabel}>الإجمالي المستحق</Text>
            <Text style={s.grandTotalValue}>{fmtAmt(invoice.total_amount)}</Text>
          </View>
        </View>

        {/* Payment confirmation (if paid) */}
        {invoice.paid_date && invoice.status === 'paid' && (
          <View style={s.paymentBox}>
            <Text style={s.paymentTitle}>تأكيد الدفع</Text>
            <Text style={s.paymentText}>
              تم استلام المبلغ بالكامل بتاريخ {fmtDate(invoice.paid_date)}
              {invoice.payment_method
                ? `  —  طريقة الدفع: ${PAYMENT_LABELS[invoice.payment_method] ?? invoice.payment_method}`
                : ''}
            </Text>
          </View>
        )}

        {/* Notes */}
        {invoice.notes && (
          <View style={s.notesBox}>
            <Text style={s.notesTitle}>ملاحظات</Text>
            <Text style={s.notesText}>{invoice.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <Text
          style={s.footer}
          render={({ pageNumber, totalPages }) =>
            `صفحة ${pageNumber} من ${totalPages}  •  نظام إدارة العقارات المتكامل  •  شكراً لتعاملكم معنا`
          }
          fixed
        />
      </Page>
    </Document>
  )
}
