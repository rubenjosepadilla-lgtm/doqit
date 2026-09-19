import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if ((current + ' ' + word).trim().length > maxChars) {
      if (current) lines.push(current.trim())
      current = word
    } else {
      current = (current + ' ' + word).trim()
    }
  }
  if (current) lines.push(current.trim())
  return lines
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li>/gi, '• ')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function generateSignedPdf(params: {
  title: string
  documentType: string
  contentHtml: string
  contentHash: string
  signerName: string
  signerEmail: string
  signedAt: string
  manifestHash: string
  otpVerifiedAt: string
  clauseVersion: string
  ipAddress?: string | null
  tsaTimestamp?: string | null
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
  const fontMono = await doc.embedFont(StandardFonts.Courier)

  const margin = 50
  const pageWidth = 595
  const pageHeight = 842
  const contentWidth = pageWidth - margin * 2

  let page = doc.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  function newPage() {
    page = doc.addPage([pageWidth, pageHeight])
    y = pageHeight - margin
  }

  function ensureSpace(needed: number) {
    if (y - needed < margin + 40) newPage()
  }

  function drawText(text: string, opts: { size?: number; bold?: boolean; mono?: boolean; color?: [number, number, number]; indent?: number }) {
    const { size = 10, bold = false, mono = false, color = [0.1, 0.1, 0.1], indent = 0 } = opts
    const font = mono ? fontMono : bold ? fontBold : fontRegular
    const maxChars = mono ? 70 : Math.floor(contentWidth / (size * 0.55))
    const lines = wrapText(text, maxChars)
    for (const line of lines) {
      ensureSpace(size + 4)
      page.drawText(line, { x: margin + indent, y, size, font, color: rgb(color[0], color[1], color[2]) })
      y -= size + 4
    }
  }

  function drawHRule(color: [number, number, number] = [0.85, 0.85, 0.85]) {
    ensureSpace(10)
    page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(color[0], color[1], color[2]) })
    y -= 8
  }

  // Header bar
  page.drawRectangle({ x: 0, y: pageHeight - 60, width: pageWidth, height: 60, color: rgb(0.11, 0.31, 0.85) })
  page.drawText('Doqit', { x: margin, y: pageHeight - 38, size: 22, font: fontBold, color: rgb(1, 1, 1) })
  page.drawText('Firma Electrónica Simple · Ley 19.799 · Chile', { x: margin + 90, y: pageHeight - 38, size: 9, font: fontRegular, color: rgb(0.8, 0.88, 1) })

  y = pageHeight - 80

  // Title
  y -= 10
  drawText(params.title, { size: 16, bold: true })
  y -= 4
  drawText(
    params.documentType === 'carta_oferta' ? 'Carta de Oferta' : 'Contrato de Trabajo',
    { size: 10, color: [0.4, 0.4, 0.4] }
  )
  y -= 8
  drawHRule()

  // Document content
  drawText('CONTENIDO DEL DOCUMENTO', { size: 8, bold: true, color: [0.5, 0.5, 0.5] })
  y -= 4
  const bodyLines = stripHtml(params.contentHtml).split('\n')
  for (const line of bodyLines) {
    if (!line.trim()) { y -= 6; continue }
    drawText(line, { size: 10 })
  }

  y -= 12
  drawHRule()

  // Signature block
  drawText('DATOS DE LA FIRMA ELECTRÓNICA SIMPLE', { size: 8, bold: true, color: [0.5, 0.5, 0.5] })
  y -= 6

  const rows = [
    ['Firmante', params.signerName],
    ['Correo', params.signerEmail],
    ['Fecha y hora', new Date(params.signedAt).toLocaleString('es-CL')],
    ['OTP verificado', new Date(params.otpVerifiedAt).toLocaleString('es-CL')],
    ['Cláusula', params.clauseVersion],
    ...(params.ipAddress ? [['IP', params.ipAddress]] : []),
    ...(params.tsaTimestamp ? [['Sello de tiempo (TSA)', new Date(params.tsaTimestamp).toLocaleString('es-CL')]] : []),
  ]
  for (const [label, value] of rows) {
    ensureSpace(16)
    page.drawText(label + ':', { x: margin, y, size: 9, font: fontBold, color: rgb(0.3, 0.3, 0.3) })
    page.drawText(value, { x: margin + 140, y, size: 9, font: fontRegular, color: rgb(0.1, 0.1, 0.1) })
    y -= 14
  }

  y -= 6
  drawHRule()

  // Hashes
  drawText('INTEGRIDAD Y TRAZABILIDAD', { size: 8, bold: true, color: [0.5, 0.5, 0.5] })
  y -= 4
  drawText('Hash del contenido (SHA-256):', { size: 8, bold: true })
  drawText(params.contentHash, { size: 7.5, mono: true, color: [0.3, 0.3, 0.6] })
  y -= 4
  drawText('Hash del manifiesto (SHA-256):', { size: 8, bold: true })
  drawText(params.manifestHash, { size: 7.5, mono: true, color: [0.3, 0.3, 0.6] })

  y -= 10
  drawHRule()

  // Footer legal
  drawText(
    'Este documento fue firmado electrónicamente mediante Doqit, conforme a la Ley 19.799 sobre Documentos Electrónicos, Firma Electrónica y Servicios de Certificación. La firma simple produce los mismos efectos jurídicos que una firma manuscrita según el artículo 3° de dicha ley.',
    { size: 8, color: [0.5, 0.5, 0.5] }
  )
  y -= 6
  drawText('Verificable en: doqit.vercel.app/verificar - Documento generado por Doqit - doqit.vercel.app', { size: 7.5, color: [0.6, 0.6, 0.6] })

  return doc.save()
}
