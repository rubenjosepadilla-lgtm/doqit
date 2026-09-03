'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function InvitePage() {
  const [form, setForm] = useState({ fullName: '', email: '', rut: '', phone: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const router = useRouter()
  const supabase = createClient()

  function set(field: string) { return (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [field]: e.target.value })) }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error: err } = await supabase.from('candidates').insert({
      recruiter_id: user!.id,
      full_name: form.fullName,
      email: form.email,
      rut: form.rut || null,
      phone: form.phone || null,
      status: 'INVITED',
    }).select('invite_token').single()

    if (err) { setError(err.message); setLoading(false); return }
    const link = `${window.location.origin}/invite/${data.invite_token}`
    setInviteLink(link)
    setLoading(false)
  }

  if (inviteLink) return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">¡Candidato invitado!</h1>
      <div className="bg-green-50 border border-green-200 rounded-2xl p-6 mb-6">
        <p className="text-sm text-green-700 mb-3 font-medium">Comparte este link con {form.fullName}:</p>
        <div className="bg-white border border-green-200 rounded-lg px-4 py-3 text-sm font-mono text-gray-700 break-all">{inviteLink}</div>
        <button onClick={() => { navigator.clipboard.writeText(inviteLink) }}
          className="mt-3 text-xs text-green-700 hover:underline">Copiar link</button>
      </div>
      <button onClick={() => router.push('/dashboard/candidates')}
        className="bg-blue-700 text-white px-6 py-2 rounded-lg text-sm hover:bg-blue-800">
        Ver todos los candidatos
      </button>
    </div>
  )

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold text-gray-900 mb-8">Invitar candidato</h1>
      <form onSubmit={handleInvite} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        {[
          { label: 'Nombre completo *', field: 'fullName', type: 'text', required: true },
          { label: 'Email *', field: 'email', type: 'email', required: true },
          { label: 'RUT (opcional)', field: 'rut', type: 'text', required: false },
          { label: 'Teléfono (opcional)', field: 'phone', type: 'tel', required: false },
        ].map(({ label, field, type, required }) => (
          <div key={field}>
            <label className="text-sm font-medium text-gray-700">{label}</label>
            <input type={type} value={form[field as keyof typeof form]} onChange={set(field)} required={required}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        ))}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full bg-blue-700 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50">
          {loading ? 'Creando link...' : 'Generar link de invitación'}
        </button>
      </form>
    </div>
  )
}
