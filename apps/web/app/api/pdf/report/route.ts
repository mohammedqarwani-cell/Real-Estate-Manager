import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { registerArabicFontServer } from '@/components/pdf/fonts-server'
import { ReportDocument } from '@/components/pdf/ReportDocument'
import type { ReportDocumentData } from '@/components/pdf/ReportDocument'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    console.log('[PDF/report] cwd:', process.cwd())
    registerArabicFontServer()
    const data: ReportDocumentData = await request.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(React.createElement(ReportDocument, { data }) as any)
    return new Response(new Uint8Array(buffer), {
      headers: { 'Content-Type': 'application/pdf' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : ''
    console.error('[PDF/report]', err)
    return new Response(JSON.stringify({ error: 'PDF generation failed', message, stack }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
