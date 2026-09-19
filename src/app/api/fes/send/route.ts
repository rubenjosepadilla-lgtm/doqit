import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
import { createHash } from 'crypto'
import { Resend } from 'resend'

export const dynamic = 'force-dynamic'

const resend = new Resend(process.env.RESEND_API_KEY)

function sha256(text: string) {
  return createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex')
}

function toSafeHeader(text: string) {
  return text.replace(/[^\x00-\xFF]/g, '?')
}

function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
      cookies: { getAll() { return [] }, setAll() {} },
    }
  )
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

export async function POST(req: Request) {
  let step = 'init'
  try {
    step = 'parse_request'
    const { documentId } = await req.json()

    step = 'get_user'
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    step = 'create_service'
    const service = createServiceClient()

    step = 'load_doc'
    const { data: doc, error: docError } = await service
      .from('fes_documents')
      .select('id, title, document_type, content_html, status, invite_token, candidate_id, recruiter_id, candidates(full_name, email)')
      .eq('id', documentId)
      .eq('recruiter_id', user.id)
      .single()

    if (docError) {
      console.error('[FES send] doc error:', docError)
      return NextResponse.json({ error: `[load_doc] ${docError.message}` }, { status: 500 })
    }
    if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
    if (doc.status !== 'DRAFT') return NextResponse.json({ error: 'Ya fue enviado' }, { status: 400 })

    step = 'get_clause'
    const { data: clause } = await service
      .from('fes_clauses')
      .select('id, version')
      .eq('active', true)
      .contains('document_types', [doc.document_type])
      .single()

    step = 'compute_hash'
    const contentHash = sha256(doc.content_html)
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()

    step = 'update_doc'
    await service.from('fes_documents').update({
      status: 'SENT',
      content_hash: contentHash,
      clause_id: clause?.id ?? null,
      expires_at: expiresAt,
      sent_at: new Date().toISOString(),
    }).eq('id', documentId)

    step = 'append_event'
    await appendEvent(service, documentId, 'document_sent', `recruiter:${user.id}`, {
      content_hash: contentHash,
      expires_at: expiresAt,
    }, null)

    step = 'build_email'
    const candidate = doc.candidates as any
    const signingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/fes/${doc.invite_token}`
    const safeTitle = toSafeHeader(doc.title)
    const safeName = toSafeHeader(candidate?.full_name ?? '')
    const safeEmail = toSafeHeader(candidate?.email ?? '')

    const emailSubject = `Tienes un documento para firmar: ${safeTitle}`
    const emailHtml = [
      `<p>Hola ${safeName},</p>`,
      `<p>Se te ha enviado el siguiente documento para tu firma electronica:</p>`,
      `<p><strong>${safeTitle}</strong></p>`,
      `<p>Por favor revisa y firma el documento antes del <strong>${new Date(expiresAt).toLocaleDateString('es-CL')}</strong>.</p>`,
      `<p><a href="${signingUrl}" style="background:#1d4ed8;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:8px;">Revisar y firmar documento</a></p>`,
      `<p style="color:#9ca3af;font-size:12px;margin-top:24px;">Doqit - Firma Electronica Simple (Ley 19.799)</p>`,
    ].join('\n')

    step = 'send_email'
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'Doqit <onboarding@resend.dev>',
      to: safeEmail,
      subject: emailSubject,
      html: emailHtml,
    })

    if (emailError) {
      console.error('[FES send] email error:', emailError)
      return NextResponse.json({ error: `[send_email] ${(emailError as any).message ?? JSON.stringify(emailError)}` }, { status: 500 })
    }

    return NextResponse.json({ ok: true, contentHash, signingUrl })
  } catch (e: any) {
    console.error(`[FES send] error at step=${step}:`, e)
    return NextResponse.json({ error: `[${step}] ${e.message ?? 'Error interno'}` }, { status: 500 })
  }
}
