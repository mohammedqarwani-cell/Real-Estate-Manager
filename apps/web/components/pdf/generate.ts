'use client'
/**
 * PDF generation helpers — calls server-side API routes (/api/pdf/*).
 * Generating PDFs server-side (renderToBuffer) avoids the React 19 / @react-pdf/renderer
 * reconciler conflict that occurs when pdf() is called in the browser.
 */
import type { ContractForPDF } from './ContractDocument'
import type { InvoiceForPDF } from './InvoiceDocument'
import type { ReportDocumentData } from './ReportDocument'

async function postPDF(route: string, body: unknown): Promise<Blob> {
  const res = await fetch(route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => 'unknown error')
    throw new Error(`PDF generation failed (${res.status}): ${text}`)
  }
  return res.blob()
}

export async function generateContractPDF(contract: ContractForPDF): Promise<Blob> {
  return postPDF('/api/pdf/contract', contract)
}

export async function generateInvoicePDF(invoice: InvoiceForPDF): Promise<Blob> {
  return postPDF('/api/pdf/invoice', invoice)
}

export async function generateReportPDF(data: ReportDocumentData): Promise<Blob> {
  return postPDF('/api/pdf/report', data)
}
