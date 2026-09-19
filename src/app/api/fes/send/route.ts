import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'
import { Resend } from 'resend'
import * as https from 'node:https'

export const dynamic = 'force-dynamic'

const resend = new Resend(process.env.RESEND_API_KEY)

function sha256(text: string) {
  return createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex')
}

function toSafeHeader(text: string) {
  return text.replace(/[^\x00-\xFF]/g, '?')
}

// Use node:https directly to avoid Next.js fetch instrumentation ByteString issues
function supabaseRequest(path: string, method: string, body?: object): Promise<any> {
  return new Promise((resolve, reject) => {
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const parsed = new URL(path, baseUrl)

    const bodyStr = body ? JSON.stringify(body) : undefined
    const headers: Record<string, string> = {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal',
    }
    if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr).toString()

    const options: https.RequestOptions = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method,
      headers,
    }

    const nodeReq = https.request(options, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        try { resolve(text ? JSON.parse(text) : null) } catch { resolve(text) }
      })
    })
    nodeReq.on('error', reject)
    if (bodyStr) nodeReq.write(bodyStr)
    nodeReq.end()
  })
}

async function appendEvent(
  documentId: string,
  eventType: string,
  actor: string,
  eventData: object,
  prevHash: string | null,
) {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const hash = sha256(`${id}${eventType}${JSON.stringify(eventData)}${prevHash ?? ''}${now}`)
  await supabaseRequest('/rest/v1/fes_events', 'POST', {
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

    step = 'load_doc'
    const docUrl = `/rest/v1/fes_documents?select=id,title,document_type,content_html,status,invite_token,candidate_id,recruiter_id,candidates(full_name,email)&id=eq.${documentId}&recruiter_id=eq.${user.id}`
    const doc = await supabaseRequest(docUrl, 'GET')

    if (!doc || doc.code) {
      return NextResponse.json({ error: `[load_doc] ${doc?.message ?? 'No encontrado'}` }, { status: 500 })
    }
    // PostgREST returns array; we need single row
    const docRow = Array.isArray(doc) ? doc[0] : doc
    if (!docRow) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
    if (docRow.status !== 'DRAFT') return NextResponse.json({ error: 'Ya fue enviado' }, { status: 400 })

    step = 'get_clause'
    const clauseUrl = `/rest/v1/fes_clauses?select=id,version&active=eq.true&document_types=cs.%5B"${docRow.document_type}"%5D&limit=1`
    const clauseRes = await supabaseRequest(clauseUrl, 'GET')
    const clause = Array.isArray(clauseRes) ? clauseRes[0] : clauseRes

    step = 'compute_hash'
    const contentHash = sha256(docRow.content_html)
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()

    step = 'update_doc'
    const updateUrl = `/rest/v1/fes_documents?id=eq.${documentId}`
    await supabaseRequest(updateUrl, 'PATCH', {
      status: 'SENT',
      content_hash: contentHash,
      clause_id: clause?.id ?? null,
      expires_at: expiresAt,
      sent_at: new Date().toISOString(),
    })

    step = 'append_event'
    await appendEvent(documentId, 'document_sent', `recruiter:${user.id}`, {
      content_hash: contentHash,
      expires_at: expiresAt,
    }, null)

    step = 'build_email'
    const candidate = docRow.candidates as any
    const signingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/fes/${docRow.invite_token}`
    const safeTitle = toSafeHeader(docRow.title)
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
