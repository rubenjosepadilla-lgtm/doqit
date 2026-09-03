import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import DocumentReview from './DocumentReview'

export default async function CandidateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: candidate } = await supabase
    .from('candidates')
    .select('*, positions(title)')
    .eq('id', id)
    .eq('recruiter_id', user!.id)
    .single()

  if (!candidate) notFound()

  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .eq('candidate_id', id)
    .order('created_at')

  const statusLabel: Record<string, { label: string; color: string }> = {
    INVITED:      { label: 'Invitado',   color: 'bg-gray-100 text-gray-600' },
    REGISTERED:   { label: 'Registrado', color: 'bg-blue-50 text-blue-700' },
    PENDING_DOCS: { label: 'Docs pendientes', color: 'bg-orange-50 text-orange-600' },
    READY:        { label: 'Listo',      color: 'bg-green-50 text-green-700' },
    REJECTED:     { label: 'Rechazado',  color: 'bg-red-50 text-red-600' },
  }
  const s = statusLabel[candidate.status] ?? { label: candidate.status, color: 'bg-gray-100 text-gray-600' }

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-semibold text-gray-900">{candidate.full_name}</h1>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>
        </div>
        <p className="text-gray-500 text-sm">{candidate.email}</p>
        {(candidate.positions as any)?.title && (
          <p className="text-gray-400 text-sm mt-0.5">Posición: {(candidate.positions as any).title}</p>
        )}
      </div>

      <h2 className="text-lg font-medium text-gray-900 mb-4">Documentos</h2>
      {!documents?.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">
          <p>El candidato aún no ha subido documentos.</p>
        </div>
      ) : (
        <DocumentReview documents={documents} candidateId={id} />
      )}
    </div>
  )
}
