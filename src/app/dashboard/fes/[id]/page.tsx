import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import FesDocumentDetail from './FesDocumentDetail'

export default async function FesDocDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: doc } = await supabase
    .from('fes_documents')
    .select('*, candidates(id, full_name, email, invite_token), fes_clauses(version, content_text)')
    .eq('id', id)
    .eq('recruiter_id', user!.id)
    .single()

  if (!doc) notFound()

  const { data: events } = await supabase
    .from('fes_events')
    .select('*')
    .eq('document_id', id)
    .order('created_at')

  const { data: signature } = await supabase
    .from('fes_signatures')
    .select('*')
    .eq('document_id', id)
    .maybeSingle()

  return <FesDocumentDetail doc={doc} events={events ?? []} signature={signature} />
}
