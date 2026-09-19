import { createClient } from '@/lib/supabase/server'
import NewFesForm from './NewFesForm'

export default async function NewFesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: candidates } = await supabase
    .from('candidates')
    .select('id, full_name, email')
    .eq('recruiter_id', user!.id)
    .order('full_name')

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">Nuevo documento FES</h1>
      <p className="text-sm text-gray-400 mb-8">Carta de oferta o contrato con firma electrónica simple (Ley 19.799)</p>
      <NewFesForm candidates={candidates ?? []} />
    </div>
  )
}
