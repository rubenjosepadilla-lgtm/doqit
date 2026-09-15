'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`,
    })
    if (error) { setError(error.message); setLoading(false); return }
    setSent(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-md">
        <Link href="/" className="text-2xl font-bold text-blue-700 block mb-8">Doqit</Link>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Recuperar contraseña</h1>
        {sent ? (
          <div className="mt-4">
            <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-4 py-3">
              Te enviamos un enlace a <strong>{email}</strong>. Revisa tu bandeja de entrada.
            </p>
            <p className="text-sm text-gray-500 mt-4 text-center">
              <Link href="/login" className="text-blue-700 hover:underline">Volver al inicio de sesión</Link>
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-6">Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full bg-blue-700 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50">
                {loading ? 'Enviando...' : 'Enviar enlace'}
              </button>
            </form>
            <p className="text-sm text-gray-500 mt-4 text-center">
              <Link href="/login" className="text-blue-700 hover:underline">Volver al inicio de sesión</Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
