import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import CandidateInviteForm from './CandidateInviteForm'

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()

  const { data: candidate } = await supabase
    .from('candidates')
    .select('id, full_name, email, status, position_id, positions(title)')
    .eq('invite_token', token)
    .single()

  if (!candidate) notFound()

  const { data: existingDocs } = await supabase
    .from('documents')
    .select('id, document_type, file_name, status, rejection_reason')
    .eq('candidate_id', candidate.id)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <span className="text-2xl font-bold text-blue-700">Doqit</span>
          <h1 className="text-2xl font-semibold text-gray-900 mt-4">
            Hola, {candidate.full_name}
          </h1>
          {(candidate.positions as any)?.title && (
            <p className="text-gray-500 mt-1">Postulación: {(candidate.positions as any).title}</p>
          )}
          <p className="text-sm text-gray-400 mt-2">
            Sube tus documentos para continuar el proceso de selección.
          </p>
        </div>
        <CandidateInviteForm candidate={candidate} token={token} existingDocs={existingDocs ?? []} />
      </div>
    </div>
  )
}
