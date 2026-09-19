import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

function sha256(text: string) {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

async function appendEvent(
  serviceClient: any,
  documentId: string,
  eventType: string,
  actor: string,
  eventData: object,
  prevHash: string | null,
) {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const hash = sha256(`${id}${eventType}${JSON.stringify(eventData)}${prevHash ?? ''}${now}`)

  await serviceClient.from('fes_events').insert({
    id,
    document_id: documentId,
    event_type: eventType,
    actor,
    event_data: eventData,
    prev_event_hash: prevHash,
    event_hash: hash,
    created_at: now,
  })
  return hash
}

export async function POST(req: Request) {
  const { documentId } = await req.json()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Load document
  const { data: doc, error: docError } = await service
    .from('fes_documents')
    .select('*, candidates(full_name, email), fes_clauses(version, content_text)')
    .eq('id', documentId)
    .eq('recruiter_id', user.id)
    .single()

  if (docError) {
    console.error('[FES send] doc query error:', docError)
    return NextResponse.json({ error: docError.message }, { status: 500 })
  }
  if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
  if (doc.status !== 'DRAFT') return NextResponse.json({ error: 'Already sent' }, { status: 400 })

  // Get active clause
  const { data: clause } = await service
    .from('fes_clauses')
    .select('id, version')
    .eq('active', true)
    .contains('document_types', [doc.document_type])
    .single()

  // Freeze: calculate hash
  const contentHash = sha256(doc.content_html)
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()

  await service.from('fes_documents').update({
    status: 'SENT',
    content_hash: contentHash,
    clause_id: clause?.id ?? null,
    expires_at: expiresAt,
    sent_at: new Date().toISOString(),
  }).eq('id', documentId)

  // Audit: document_sent
  const lastHash = await appendEvent(service, documentId, 'document_sent', `recruiter:${user.id}`, {
    content_hash: contentHash,
    expires_at: expiresAt,
  }, null)

  const candidate = doc.candidates as any
  const signingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/fes/${doc.invite_token}`

  console.log('[FES send] sending email to', candidate?.email, 'signingUrl:', signingUrl)

  // Email candidate
  const emailResult = await resend.emails.send({
    from: 'Doqit <onboarding@resend.dev>',
    to: candidate.email,
    subject: `Tienes un documento para firmar: ${doc.title}`,
    html: `
      <p>Hola ${candidate.full_name},</p>
      <p>Se te ha enviado el siguiente documento para tu firma electrónica:</p>
      <p><strong>${doc.title}</strong></p>
      <p>Por favor revisa y firma el documento antes de <strong>${new Date(expiresAt).toLocaleDateString('es-CL')}</strong>.</p>
      <p>
        <a href="${signingUrl}" style="background:#1d4ed8;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:8px;">
          Revisar y firmar documento
        </a>
      </p>
      <p style="color:#9ca3af;font-size:12px;margin-top:24px;">Doqit — Firma Electrónica Simple (Ley 19.799)</p>
    `,
  })

  if (emailResult.error) {
    console.error('[FES send] email error:', emailResult.error)
    return NextResponse.json({ error: `Email no enviado: ${emailResult.error.message}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true, contentHash, signingUrl })
}
