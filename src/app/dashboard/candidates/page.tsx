import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { UserPlus } from 'lucide-react'

const statusLabel: Record<string, { label: string; color: string }> = {
  INVITED:      { label: 'Invitado',   color: 'bg-gray-100 text-gray-600' },
  REGISTERED:   { label: 'Registrado', color: 'bg-blue-50 text-blue-700' },
  PENDING_DOCS: { label: 'Pendiente',  color: 'bg-orange-50 text-orange-600' },
  READY:        { label: 'Listo',      color: 'bg-green-50 text-green-700' },
  REJECTED:     { label: 'Rechazado',  color: 'bg-red-50 text-red-600' },
}

export default async function CandidatesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: candidates } = await supabase
    .from('candidates')
    .select('id, full_name, email, status, created_at, positions(title)')
    .eq('recruiter_id', user!.id)
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Candidatos</h1>
        <Link href="/dashboard/candidates/invite"
          className="flex items-center gap-2 bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-800">
          <UserPlus size={16} /> Invitar candidato
        </Link>
      </div>

      {!candidates?.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
          <p className="text-lg mb-2">Sin candidatos aún</p>
          <p className="text-sm">Invita tu primer candidato con el botón de arriba.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Nombre', 'Email', 'Posición', 'Estado', 'Fecha'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {candidates.map(c => {
                const s = statusLabel[c.status] ?? { label: c.status, color: 'bg-gray-100 text-gray-600' }
                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <Link href={`/dashboard/candidates/${c.id}`} className="hover:text-blue-700">{c.full_name}</Link>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{c.email}</td>
                    <td className="px-4 py-3 text-gray-500">{(c.positions as any)?.title ?? '—'}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span></td>
                    <td className="px-4 py-3 text-gray-400">{new Date(c.created_at).toLocaleDateString('es-CL')}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
