import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { registerArabicFontServer } from '@/components/pdf/fonts-server'
import { InvoiceDocument } from '@/components/pdf/InvoiceDocument'
import type { InvoiceForPDF } from '@/components/pdf/InvoiceDocument'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    registerArabicFontServer()
    const invoice: InvoiceForPDF = await request.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(React.createElement(InvoiceDocument, { invoice }) as any)
    return new Response(new Uint8Array(buffer), {
      headers: { 'Content-Type': 'application/pdf' },
    })
  } catch (err) {
    console.error('[PDF/invoice]', err)
    return new Response(JSON.stringify({ error: 'PDF generation failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
