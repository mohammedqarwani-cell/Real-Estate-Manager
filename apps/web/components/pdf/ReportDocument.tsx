import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
// ─── Types ──────────────────────────────────────────────────────────────────

export interface ReportDocumentData {
  title: string
  subtitle: string
  period: string
  generatedAt: string
  summaryStats: Array<{ label: string; value: string; highlight?: boolean }>
  chartImage?: string | null // base64 PNG data URL
  tableHeaders: string[]
  tableRows: string[][]
  colWidths?: number[] // flex weights for columns, defaults to equal
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const BLUE = '#1e40af'
const LIGHT_BG = '#f8fafc'

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
    borderBottom: 2,
    borderBottomColor: BLUE,
    paddingBottom: 12,
    marginBottom: 20,
  },
  hdrTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 4,
  },
  hdrTitle: { fontSize: 20, fontWeight: 'bold', color: BLUE },
  hdrSubtitle: { fontSize: 10, color: '#64748b', marginTop: 2 },
  hdrMeta: { fontSize: 8.5, color: '#94a3b8', textAlign: 'left' },
  // ── Stats row ──
  statsRow: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: LIGHT_BG,
    padding: 10,
    borderTop: 2,
    borderTopColor: '#e2e8f0',
  },
  statBoxHighlight: {
    backgroundColor: '#eff6ff',
    borderTopColor: BLUE,
  },
  statLabel: { fontSize: 8.5, color: '#64748b', textAlign: 'right', marginBottom: 3 },
  statValue: { fontSize: 14, fontWeight: 'bold', color: '#0f172a', textAlign: 'right' },
  statValueHighlight: { color: BLUE },
  // ── Chart ──
  chartContainer: {
    marginBottom: 20,
    backgroundColor: LIGHT_BG,
    padding: 8,
  },
  chartImage: { width: '100%', objectFit: 'contain' },
  chartTitle: { fontSize: 9, color: '#64748b', textAlign: 'center', marginBottom: 6 },
  // ── Table ──
  tableWrapper: { marginBottom: 16 },
  tableHdr: {
    flexDirection: 'row',
    backgroundColor: BLUE,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableHdrCell: { fontSize: 8.5, fontWeight: 'bold', color: '#ffffff', textAlign: 'right' },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottom: 1,
    borderBottomColor: '#e2e8f0',
  },
  tableRowAlt: { backgroundColor: LIGHT_BG },
  tableCell: { fontSize: 8.5, color: '#0f172a', textAlign: 'right' },
  tableCellGray: { fontSize: 8.5, color: '#64748b', textAlign: 'right' },
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

// ─── Main Document ────────────────────────────────────────────────────────────

export function ReportDocument({ data }: { data: ReportDocumentData }) {
  const colCount = data.tableHeaders.length
  const colWidths = data.colWidths ?? Array(colCount).fill(1)

  return (
    <Document title={data.title} author="نظام إدارة العقارات" language="ar">
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.hdr}>
          <View style={s.hdrTop}>
            <Text style={s.hdrMeta}>
              {'نظام إدارة العقارات\n'}
              {data.generatedAt}
            </Text>
            <View>
              <Text style={s.hdrTitle}>{data.title}</Text>
              <Text style={s.hdrSubtitle}>{data.subtitle}</Text>
              {data.period ? (
                <Text style={[s.hdrSubtitle, { color: '#475569' }]}>{data.period}</Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* Summary Stats */}
        {data.summaryStats.length > 0 && (
          <View style={s.statsRow}>
            {data.summaryStats.map((stat, i) => (
              <View key={i} style={[s.statBox, stat.highlight ? s.statBoxHighlight : {}]}>
                <Text style={s.statLabel}>{stat.label}</Text>
                <Text style={[s.statValue, stat.highlight ? s.statValueHighlight : {}]}>
                  {stat.value}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Chart image (captured from browser) */}
        {data.chartImage && (
          <View style={s.chartContainer}>
            <Text style={s.chartTitle}>الرسم البياني</Text>
            <Image src={data.chartImage} style={s.chartImage} />
          </View>
        )}

        {/* Data Table */}
        {data.tableRows.length > 0 && (
          <View style={s.tableWrapper}>
            {/* Header row */}
            <View style={s.tableHdr}>
              {[...data.tableHeaders].reverse().map((header, i) => (
                <Text
                  key={i}
                  style={[s.tableHdrCell, { flex: colWidths[data.tableHeaders.length - 1 - i] }]}
                >
                  {header}
                </Text>
              ))}
            </View>

            {/* Data rows */}
            {data.tableRows.map((row, ri) => (
              <View key={ri} style={[s.tableRow, ri % 2 === 1 ? s.tableRowAlt : {}]}>
                {[...row].reverse().map((cell, ci) => (
                  <Text
                    key={ci}
                    style={[s.tableCell, { flex: colWidths[row.length - 1 - ci] }]}
                  >
                    {cell ?? '—'}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* Footer */}
        <Text
          style={s.footer}
          render={({ pageNumber, totalPages }) =>
            `صفحة ${pageNumber} من ${totalPages}  •  نظام إدارة العقارات المتكامل  •  ${data.generatedAt}`
          }
          fixed
        />
      </Page>
    </Document>
  )
}
