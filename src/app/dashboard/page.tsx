import { createClient } from '@/lib/supabase/server'

export default async function DashboardHome() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ count: totalCandidates }, { count: readyCandidates }, { count: pendingDocs }] = await Promise.all([
    supabase.from('candidates').select('*', { count: 'exact', head: true }).eq('recruiter_id', user!.id),
    supabase.from('candidates').select('*', { count: 'exact', head: true }).eq('recruiter_id', user!.id).eq('status', 'READY'),
    supabase.from('documents').select('*, candidates!inner(recruiter_id)', { count: 'exact', head: true })
      .eq('candidates.recruiter_id', user!.id).eq('status', 'PENDING'),
  ])

  const stats = [
    { label: 'Total candidatos', value: totalCandidates ?? 0, color: 'text-blue-700' },
    { label: 'Listos para asignar', value: readyCandidates ?? 0, color: 'text-green-600' },
    { label: 'Documentos por revisar', value: pendingDocs ?? 0, color: 'text-orange-500' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-8">Panel de control</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-6">
            <p className="text-sm text-gray-500 mb-2">{s.label}</p>
            <p className={`text-4xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">
        <p className="text-lg mb-2">👋 Comienza invitando candidatos</p>
        <p className="text-sm">Ve a <strong>Candidatos → Invitar</strong> para enviar tu primer link de invitación.</p>
      </div>
    </div>
  )
}
