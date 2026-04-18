import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
// ─── Types ──────────────────────────────────────────────────────────────────

export type ContractForPDF = {
  id: string
  start_date: string
  end_date: string
  monthly_rent: number
  security_deposit: number | null
  payment_day: number | null
  payment_cycle: string | null
  terms: string | null
  created_at: string
  tenant: {
    full_name: string
    email: string | null
    phone: string | null
    national_id: string | null
    company_name: string | null
  } | null
  unit: {
    unit_number: string
    floor: number | null
    type: string | null
    area: number | null
    property: {
      name: string
      address: string
      city: string | null
    } | null
  } | null
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const BLUE = '#1e40af'

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
  bismi: {
    textAlign: 'center',
    fontSize: 13,
    color: BLUE,
    marginBottom: 8,
  },
  hdr: {
    borderTop: 2,
    borderTopColor: BLUE,
    borderBottom: 2,
    borderBottomColor: BLUE,
    paddingVertical: 8,
    marginBottom: 18,
  },
  hdrTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: BLUE,
    textAlign: 'center',
  },
  hdrSub: {
    fontSize: 10,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
    backgroundColor: '#f8fafc',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  metaText: { fontSize: 9, color: '#475569' },
  sec: { marginBottom: 12 },
  secHdr: { backgroundColor: BLUE, paddingVertical: 5, paddingHorizontal: 10 },
  secTitle: { fontSize: 11, fontWeight: 'bold', color: '#ffffff', textAlign: 'right' },
  secBody: { borderLeft: 1, borderRight: 1, borderBottom: 1, borderColor: '#bfdbfe' },
  row: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderBottom: 1,
    borderBottomColor: '#e2e8f0',
  },
  rowAlt: { backgroundColor: '#f8fafc' },
  rLabel: { fontSize: 9, color: '#64748b', flex: 1, textAlign: 'right' },
  rValue: { fontSize: 9, fontWeight: 'bold', color: '#0f172a', flex: 2, textAlign: 'right' },
  termsText: {
    fontSize: 8.5,
    color: '#334155',
    textAlign: 'right',
    paddingVertical: 6,
    paddingHorizontal: 10,
    lineHeight: 1.8,
  },
  clauseTitle: {
    fontSize: 9.5,
    fontWeight: 'bold',
    color: BLUE,
    textAlign: 'right',
    marginBottom: 4,
  },
  clause: {
    fontSize: 8.5,
    color: '#475569',
    textAlign: 'right',
    lineHeight: 1.7,
    marginBottom: 3,
  },
  sigSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 24,
    borderTop: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 18,
  },
  sigBox: { width: '40%' },
  sigTitle: { fontSize: 10, fontWeight: 'bold', color: BLUE, textAlign: 'center', marginBottom: 28 },
  sigLine: { borderBottom: 1, borderBottomColor: '#334155', marginBottom: 5 },
  sigName: { fontSize: 8.5, color: '#64748b', textAlign: 'center' },
  sigNameMt: { fontSize: 8.5, color: '#64748b', textAlign: 'center', marginTop: 3 },
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

const CYCLE_LABELS: Record<string, string> = {
  monthly: 'شهري',
  quarterly: 'ربعي',
  annually: 'سنوي',
}

const UNIT_TYPE_LABELS: Record<string, string> = {
  apartment: 'شقة',
  office: 'مكتب',
  retail: 'محل تجاري',
  studio: 'استوديو',
  villa: 'فيلا',
  warehouse: 'مستودع',
}

// ─── Sub-components (module level — no inner components) ─────────────────────

function InfoRow({ label, value, alt }: { label: string; value: string; alt?: boolean }) {
  return (
    <View style={alt ? { ...s.row, ...s.rowAlt } : s.row}>
      <Text style={s.rValue}>{value}</Text>
      <Text style={s.rLabel}>{label}</Text>
    </View>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Section({ title, children }: { title: string; children: any }) {
  return (
    <View style={s.sec}>
      <View style={s.secHdr}>
        <Text style={s.secTitle}>{title}</Text>
      </View>
      <View style={s.secBody}>{children}</View>
    </View>
  )
}

// ─── Main Document ────────────────────────────────────────────────────────────

export function ContractDocument({ contract }: { contract: ContractForPDF }) {
  const tenant = contract.tenant
  const unit = contract.unit
  const property = unit?.property
  const contractNum = contract.id.slice(0, 8).toUpperCase()

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('ar-AE', { year: 'numeric', month: 'long', day: 'numeric' })

  const months = Math.round(
    (new Date(contract.end_date).getTime() - new Date(contract.start_date).getTime()) /
      (1000 * 60 * 60 * 24 * 30)
  )

  return (
    <Document title={`عقد إيجار - ${contractNum}`} author="نظام إدارة العقارات" language="ar">
      <Page size="A4" style={s.page}>
        {/* بسملة */}
        <Text style={s.bismi}>بسم الله الرحمن الرحيم</Text>

        {/* Header */}
        <View style={s.hdr}>
          <Text style={s.hdrTitle}>عقد إيجار</Text>
          <Text style={s.hdrSub}>نظام إدارة العقارات المتكامل</Text>
        </View>

        {/* Meta */}
        <View style={s.metaRow}>
          <Text style={s.metaText}>تاريخ الإصدار: {fmtDate(contract.created_at)}</Text>
          <Text style={s.metaText}>رقم العقد: {contractNum}</Text>
        </View>

        {/* Section 1: المؤجر */}
        <Section title="أولاً: بيانات المؤجر">
          <InfoRow label="اسم الشركة" value="شركة إدارة العقارات" />
          <InfoRow label="صفة المؤجر" value="مالك العقار / المالك الرسمي" alt />
        </Section>

        {/* Section 2: المستأجر */}
        <Section title="ثانياً: بيانات المستأجر">
          <InfoRow label="الاسم الكامل" value={tenant?.full_name ?? '—'} />
          {tenant?.national_id && <InfoRow label="رقم الهوية الوطنية / الإقامة" value={tenant.national_id} alt />}
          {tenant?.company_name && <InfoRow label="اسم الشركة / المنشأة" value={tenant.company_name} />}
          {tenant?.phone && <InfoRow label="رقم الهاتف" value={tenant.phone} alt />}
          {tenant?.email && <InfoRow label="البريد الإلكتروني" value={tenant.email} />}
        </Section>

        {/* Section 3: العقار */}
        <Section title="ثالثاً: بيانات العقار والوحدة المؤجرة">
          <InfoRow label="اسم العقار" value={property?.name ?? '—'} />
          <InfoRow
            label="العنوان"
            value={property ? `${property.address}${property.city ? '، ' + property.city : ''}` : '—'}
            alt
          />
          <InfoRow label="رقم الوحدة" value={`وحدة ${unit?.unit_number ?? '—'}`} />
          {unit?.floor != null && <InfoRow label="الطابق" value={String(unit.floor)} alt />}
          {unit?.type && (
            <InfoRow label="نوع الوحدة" value={UNIT_TYPE_LABELS[unit.type] ?? unit.type} />
          )}
          {unit?.area && <InfoRow label="المساحة الإجمالية" value={`${unit.area} متر مربع`} alt />}
        </Section>

        {/* Section 4: المالية والمدة */}
        <Section title="رابعاً: التفاصيل المالية ومدة العقد">
          <InfoRow label="تاريخ بداية العقد" value={fmtDate(contract.start_date)} />
          <InfoRow label="تاريخ انتهاء العقد" value={fmtDate(contract.end_date)} alt />
          <InfoRow label="مدة العقد الإجمالية" value={`${months} شهر`} />
          <InfoRow
            label="قيمة الإيجار الشهري"
            value={`${contract.monthly_rent.toLocaleString('ar-AE')} درهم إماراتي`}
            alt
          />
          <InfoRow
            label="مبلغ التأمين / التوديع"
            value={`${(contract.security_deposit ?? 0).toLocaleString('ar-AE')} درهم إماراتي`}
          />
          <InfoRow
            label="دورة سداد الإيجار"
            value={CYCLE_LABELS[contract.payment_cycle ?? 'monthly'] ?? 'شهري'}
            alt
          />
          <InfoRow
            label="موعد استحقاق الدفع"
            value={`اليوم ${contract.payment_day ?? 1} من كل شهر`}
          />
        </Section>

        {/* Section 5: الشروط الخاصة */}
        {contract.terms && (
          <View style={s.sec}>
            <View style={s.secHdr}>
              <Text style={s.secTitle}>خامساً: الشروط الخاصة بالعقد</Text>
            </View>
            <View style={s.secBody}>
              <Text style={s.termsText}>{contract.terms}</Text>
            </View>
          </View>
        )}

        {/* Section 6: الشروط العامة */}
        <View style={{ marginBottom: 14 }}>
          <Text style={s.clauseTitle}>سادساً: الشروط والأحكام العامة</Text>
          <Text style={s.clause}>
            ١. يلتزم المستأجر بدفع الإيجار في الموعد المحدد في هذا العقد وبالطريقة المتفق عليها.
          </Text>
          <Text style={s.clause}>
            ٢. لا يحق للمستأجر التنازل عن هذا العقد أو تأجير الوحدة من الباطن لأي طرف آخر دون الحصول على إذن كتابي مسبق من المؤجر.
          </Text>
          <Text style={s.clause}>
            ٣. يلتزم المستأجر بالمحافظة على الوحدة المؤجرة وتسليمها في نهاية العقد بالحالة التي استلمها عليها مع مراعاة الاستهلاك الطبيعي.
          </Text>
          <Text style={s.clause}>
            ٤. يتحمل المستأجر مسؤولية سداد فواتير الكهرباء والماء وجميع الخدمات الأخرى المرتبطة بالوحدة المؤجرة.
          </Text>
          <Text style={s.clause}>
            ٥. يحق للمؤجر فسخ هذا العقد في حال تأخر المستأجر عن سداد الإيجار لمدة تتجاوز ثلاثين (٣٠) يوماً دون عذر مقبول.
          </Text>
          <Text style={s.clause}>
            ٦. يجب على الطرف الراغب في عدم تجديد العقد إبلاغ الطرف الآخر كتابياً قبل تسعين (٩٠) يوماً على الأقل من تاريخ انتهاء العقد.
          </Text>
          <Text style={s.clause}>
            ٧. يخضع هذا العقد لأحكام قانون الإيجارات المعمول به في إمارة أبوظبي / دبي وكل نزاع ينشأ عنه يُحسم وفق الجهات القضائية المختصة.
          </Text>
        </View>

        {/* التوقيعات */}
        <View style={s.sigSection}>
          <View style={s.sigBox}>
            <Text style={s.sigTitle}>توقيع المؤجر</Text>
            <View style={s.sigLine} />
            <Text style={s.sigName}>شركة إدارة العقارات</Text>
            <Text style={s.sigNameMt}>التاريخ: ...............</Text>
          </View>
          <View style={s.sigBox}>
            <Text style={s.sigTitle}>توقيع المستأجر</Text>
            <View style={s.sigLine} />
            <Text style={s.sigName}>{tenant?.full_name ?? '—'}</Text>
            <Text style={s.sigNameMt}>التاريخ: ...............</Text>
          </View>
        </View>

        {/* Footer */}
        <Text
          style={s.footer}
          render={({ pageNumber, totalPages }) =>
            `صفحة ${pageNumber} من ${totalPages}  •  نظام إدارة العقارات المتكامل  •  هذا العقد صادر إلكترونياً ويُعدّ نسخة رسمية معتمدة`
          }
          fixed
        />
      </Page>
    </Document>
  )
}
