import { createClient as createServerClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import CandidateInviteForm from './CandidateInviteForm'

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: candidate } = await supabase
    .from('candidates')
    .select('id, full_name, email, status, position_id, positions(title)')
    .eq('invite_token', token)
    .single()

  if (!candidate) notFound()

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
        <CandidateInviteForm candidate={candidate} token={token} />
      </div>
    </div>
  )
}
