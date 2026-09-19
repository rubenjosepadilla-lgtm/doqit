import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import FesSigningPortal from './FesSigningPortal'

const service = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export default async function FesTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const { data: doc } = await service
    .from('fes_documents')
    .select('*, candidates(full_name, email), fes_clauses(version, content_text, sha256)')
    .eq('invite_token', token)
    .single()

  if (!doc) notFound()

  // Mark as VIEWED if still SENT
  if (doc.status === 'SENT') {
    await service.from('fes_documents').update({ status: 'VIEWED' }).eq('id', doc.id)

    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const { createHash } = await import('crypto')
    const hash = createHash('sha256').update(`${id}document_viewed{}${now}`).digest('hex')
    await service.from('fes_events').insert({
      id, document_id: doc.id, event_type: 'document_viewed',
      actor: `candidate:${(doc.candidates as any).email}`,
      event_data: {}, event_hash: hash, created_at: now,
    })
  }

  if (doc.status === 'SIGNED') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center max-w-md w-full">
          <div className="text-4xl mb-4">✅</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Documento ya firmado</h1>
          <p className="text-gray-500 text-sm">Este documento ya fue firmado correctamente. Revisa tu correo para la confirmación.</p>
        </div>
      </div>
    )
  }

  if (doc.status === 'EXPIRED' || doc.status === 'CANCELLED') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center max-w-md w-full">
          <div className="text-4xl mb-4">⏰</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Enlace no disponible</h1>
          <p className="text-gray-500 text-sm">Este documento expiró o fue cancelado. Contacta al equipo de reclutamiento.</p>
        </div>
      </div>
    )
  }

  return <FesSigningPortal doc={doc} token={token} />
}
