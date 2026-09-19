import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

function sha256(text: string) {
  return createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex')
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

async function appendEvent(
  service: any,
  documentId: string,
  eventType: string,
  actor: string,
  eventData: object,
  prevHash: string | null,
) {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const hash = sha256(`${id}${eventType}${JSON.stringify(eventData)}${prevHash ?? ''}${now}`)
  await service.from('fes_events').insert({
    id, document_id: documentId, event_type: eventType,
    actor, event_data: eventData, prev_event_hash: prevHash, event_hash: hash, created_at: now,
  })
  return hash
}

const service = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: Request) {
  const body = await req.json()
  const { action, token } = body  // action: 'send' | 'verify', token: invite_token

  const { data: doc } = await service
    .from('fes_documents')
    .select('*, candidates(full_name, email)')
    .eq('invite_token', token)
    .in('status', ['SENT', 'VIEWED'])
    .single()

  if (!doc) return NextResponse.json({ error: 'Documento no encontrado o expirado' }, { status: 404 })

  const candidate = doc.candidates as any

  if (action === 'send') {
    const otp = generateOtp()
    const otpHash = sha256(otp)
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    // Get or create signature record
    const { data: existing } = await service
      .from('fes_signatures')
      .select('id')
      .eq('document_id', doc.id)
      .maybeSingle()

    const { data: clause } = await service
      .from('fes_clauses')
      .select('id, version, content_text, sha256')
      .eq('active', true)
      .contains('document_types', [doc.document_type])
      .single()

    if (existing) {
      await service.from('fes_signatures').update({
        otp_sent_at: new Date().toISOString(),
        otp_verified_at: null,
        // store hash in event_data via event, not in signatures directly
      }).eq('id', existing.id)
    } else {
      await service.from('fes_signatures').insert({
        document_id: doc.id,
        signer_name: candidate.full_name,
        signer_email: candidate.email,
        clause_id: clause?.id,
        clause_version: clause?.version ?? '',
        clause_sha256: clause?.sha256 ?? '',
        checkbox_prechecked: false,
        otp_channel: 'email',
        otp_sent_at: new Date().toISOString(),
      })
    }

    // Store OTP hash + expiry in fes_events
    await appendEvent(service, doc.id, 'otp_sent', `candidate:${candidate.email}`, {
      otp_hash: otpHash,
      otp_expiry: otpExpiry,
    }, null)

    await resend.emails.send({
      from: 'Doqit <onboarding@resend.dev>',
      to: candidate.email,
      subject: `Tu código de verificación: ${otp}`,
      html: `
        <p>Hola ${candidate.full_name},</p>
        <p>Tu código de verificación para firmar el documento <strong>${doc.title}</strong> es:</p>
        <p style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#1d4ed8;margin:24px 0">${otp}</p>
        <p style="color:#6b7280;font-size:14px;">Este código es válido por 10 minutos.</p>
        <p style="color:#9ca3af;font-size:12px;margin-top:24px;">Doqit - Firma Electronica Simple (Ley 19.799)</p>
      `,
    })

    return NextResponse.json({ ok: true })
  }

  if (action === 'verify') {
    const { otp } = body
    const otpHash = sha256(otp)

    // Find latest otp_sent event
    const { data: otpEvent } = await service
      .from('fes_events')
      .select('event_data, created_at')
      .eq('document_id', doc.id)
      .eq('event_type', 'otp_sent')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!otpEvent) return NextResponse.json({ error: 'No se encontró código OTP' }, { status: 400 })

    const eventData = otpEvent.event_data as any
    if (eventData.otp_hash !== otpHash) {
      return NextResponse.json({ error: 'Código incorrecto' }, { status: 400 })
    }
    if (new Date() > new Date(eventData.otp_expiry)) {
      return NextResponse.json({ error: 'Código expirado' }, { status: 400 })
    }

    await service.from('fes_signatures').update({
      otp_verified_at: new Date().toISOString(),
    }).eq('document_id', doc.id)

    await appendEvent(service, doc.id, 'otp_verified', `candidate:${candidate.email}`, {}, null)

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
}
