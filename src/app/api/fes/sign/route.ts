import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { Resend } from 'resend'
import { generateSignedPdf } from '@/lib/fes/generatePdf'
import { stampWithFreeTsa } from '@/lib/fes/tsa'

const resend = new Resend(process.env.RESEND_API_KEY)

function sha256(text: string) {
  return createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex')
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
  const { token, ip, userAgent } = await req.json()

  const { data: doc } = await service
    .from('fes_documents')
    .select('*, candidates(full_name, email), recruiters(email)')
    .eq('invite_token', token)
    .in('status', ['SENT', 'VIEWED'])
    .single()

  if (!doc) return NextResponse.json({ error: 'Documento no válido' }, { status: 404 })

  const candidate = doc.candidates as any
  const recruiter = doc.recruiters as any

  const { data: sig } = await service
    .from('fes_signatures')
    .select('*')
    .eq('document_id', doc.id)
    .single()

  if (!sig?.otp_verified_at) {
    return NextResponse.json({ error: 'OTP no verificado' }, { status: 400 })
  }

  const now = new Date().toISOString()

  // Manifest
  const manifest = {
    document_id: doc.id,
    document_type: doc.document_type,
    title: doc.title,
    content_hash: doc.content_hash,
    clause_version: sig.clause_version,
    clause_sha256: sig.clause_sha256,
    signer_name: candidate.full_name,
    signer_email: candidate.email,
    otp_verified_at: sig.otp_verified_at,
    ip_address: ip,
    user_agent: userAgent,
    signed_at: now,
  }
  const manifestHash = sha256(JSON.stringify(manifest))

  // RFC 3161 timestamp (best effort — doesn't block signing if TSA is down)
  const tsa = await stampWithFreeTsa(manifestHash)

  // Generate signed PDF
  let pdfPath: string | null = null
  try {
    const pdfBytes = await generateSignedPdf({
      title: doc.title,
      documentType: doc.document_type,
      contentHtml: doc.content_html,
      contentHash: doc.content_hash ?? '',
      signerName: candidate.full_name,
      signerEmail: candidate.email,
      signedAt: now,
      manifestHash,
      otpVerifiedAt: sig.otp_verified_at,
      clauseVersion: sig.clause_version,
      ipAddress: ip,
      tsaTimestamp: tsa?.tsaTimestamp ?? null,
    })

    pdfPath = `fes/${doc.id}/signed_${Date.now()}.pdf`
    await service.storage.from('documents').upload(pdfPath, pdfBytes, {
      contentType: 'application/pdf',
      upsert: true,
    })
  } catch (e) {
    console.error('PDF generation error:', e)
  }

  // Update signature
  await service.from('fes_signatures').update({
    ip_address: ip,
    user_agent: userAgent,
    consent_accepted_at: now,
    signed_at: now,
    manifest_hash: manifestHash,
    tsa_provider: tsa ? 'freetsa.org' : null,
    tsa_token_b64: tsa?.tsaTokenB64 ?? null,
    tsa_timestamp: tsa?.tsaTimestamp ?? null,
  }).eq('id', sig.id)

  // Update document
  await service.from('fes_documents').update({
    status: 'SIGNED',
    signed_at: now,
  }).eq('id', doc.id)

  // Audit events
  await appendEvent(service, doc.id, 'consent_accepted', `candidate:${candidate.email}`, { manifest_hash: manifestHash }, null)
  await appendEvent(service, doc.id, 'document_signed', `candidate:${candidate.email}`, { manifest_hash: manifestHash, signed_at: now, pdf_path: pdfPath }, null)
  if (tsa) {
    await appendEvent(service, doc.id, 'tsa_stamped', 'system', { provider: 'freetsa.org', timestamp: tsa.tsaTimestamp }, null)
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const verifyUrl = `${appUrl}/verificar/${manifestHash}`

  // Email recruiter
  if (recruiter?.email) {
    await resend.emails.send({
      from: 'Doqit <onboarding@resend.dev>',
      to: recruiter.email,
      subject: `${candidate.full_name} firmó: ${doc.title}`,
      html: `
        <p>Hola,</p>
        <p><strong>${candidate.full_name}</strong> firmó el documento <strong>${doc.title}</strong>.</p>
        <p>Firmado el: ${new Date(now).toLocaleString('es-CL')}</p>
        ${tsa ? `<p>Sello de tiempo RFC 3161: ${tsa.tsaTimestamp}</p>` : ''}
        <p>Verificar: <a href="${verifyUrl}">${verifyUrl}</a></p>
        <p><a href="${appUrl}/dashboard/fes/${doc.id}" style="background:#1d4ed8;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:8px;">Ver documento</a></p>
        <p style="color:#9ca3af;font-size:12px;margin-top:24px;">Doqit — Firma Electrónica Simple (Ley 19.799)</p>
      `,
    })
  }

  // Email candidate confirmation
  await resend.emails.send({
    from: 'Doqit <onboarding@resend.dev>',
    to: candidate.email,
    subject: `Confirmación de firma: ${doc.title}`,
    html: `
      <p>Hola ${candidate.full_name},</p>
      <p>Tu firma electrónica simple ha sido registrada exitosamente.</p>
      <p><strong>${doc.title}</strong></p>
      <p>Fecha y hora: ${new Date(now).toLocaleString('es-CL')}</p>
      ${tsa ? `<p>Sello de tiempo RFC 3161 aplicado (FreeTSA).</p>` : ''}
      <p>Puedes verificar la autenticidad de este documento en:<br>
        <a href="${verifyUrl}">${verifyUrl}</a>
      </p>
      <p style="color:#6b7280;font-size:13px;">Válido según Ley 19.799 de la República de Chile.</p>
      <p style="color:#9ca3af;font-size:12px;margin-top:24px;">Doqit — Firma Electrónica Simple</p>
    `,
  })

  return NextResponse.json({ ok: true, manifestHash, tsa: !!tsa })
}
