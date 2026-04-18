import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { registerArabicFontServer } from '@/components/pdf/fonts-server'
import { ContractDocument } from '@/components/pdf/ContractDocument'
import type { ContractForPDF } from '@/components/pdf/ContractDocument'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    registerArabicFontServer()
    const contract: ContractForPDF = await request.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(React.createElement(ContractDocument, { contract }) as any)
    return new Response(new Uint8Array(buffer), {
      headers: { 'Content-Type': 'application/pdf' },
    })
  } catch (err) {
    console.error('[PDF/contract]', err)
    return new Response(JSON.stringify({ error: 'PDF generation failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
