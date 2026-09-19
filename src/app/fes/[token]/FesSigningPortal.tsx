'use client'
import { useState, useRef, useEffect } from 'react'
import { CheckCircle, Mail, Shield } from 'lucide-react'

type Step = 'read' | 'otp_send' | 'otp_verify' | 'consent' | 'signed'

export default function FesSigningPortal({ doc, token }: { doc: any; token: string }) {
  const [step, setStep] = useState<Step>('read')
  const [scrolledToEnd, setScrolledToEnd] = useState(false)
  const [otpValue, setOtpValue] = useState('')
  const [otpError, setOtpError] = useState('')
  const [consentChecked, setConsentChecked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const contentRef = useRef<HTMLDivElement>(null)

  const candidate = doc.candidates as any
  const clause = doc.fes_clauses as any

  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const handler = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
        setScrolledToEnd(true)
      }
    }
    el.addEventListener('scroll', handler)
    return () => el.removeEventListener('scroll', handler)
  }, [step])

  async function sendOtp() {
    setLoading(true); setError('')
    const res = await fetch('/api/fes/otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send', token }),
    })
    setLoading(false)
    if (res.ok) setStep('otp_verify')
    else setError('Error al enviar el código. Intenta de nuevo.')
  }

  async function verifyOtp() {
    setLoading(true); setOtpError('')
    const res = await fetch('/api/fes/otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify', token, otp: otpValue }),
    })
    setLoading(false)
    if (res.ok) { setStep('consent') }
    else {
      const data = await res.json()
      setOtpError(data.error ?? 'Código incorrecto')
    }
  }

  async function sign() {
    if (!consentChecked) return
    setLoading(true); setError('')
    const res = await fetch('/api/fes/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        ip: null,
        userAgent: navigator.userAgent,
      }),
    })
    setLoading(false)
    if (res.ok) setStep('signed')
    else setError('Error al registrar la firma. Intenta de nuevo.')
  }

  if (step === 'signed') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center max-w-md w-full">
          <CheckCircle className="mx-auto text-green-500 mb-4" size={48} />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">¡Documento firmado!</h1>
          <p className="text-gray-500 text-sm">Tu firma electrónica simple ha sido registrada. Recibirás una confirmación en tu correo.</p>
          <p className="text-xs text-gray-400 mt-4">Válido según Ley 19.799 — República de Chile</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <span className="text-2xl font-bold text-blue-700">Doqit</span>
          <p className="text-xs text-gray-400 mt-1">Firma Electrónica Simple · Ley 19.799</p>
        </div>

        {/* Document */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-4">
          <div className="px-6 py-4 border-b border-gray-100">
            <h1 className="font-semibold text-gray-900">{doc.title}</h1>
            <p className="text-sm text-gray-400 mt-0.5">Para: {candidate.full_name} · {candidate.email}</p>
          </div>
          <div ref={contentRef}
            className="px-6 py-5 prose prose-sm max-w-none text-gray-700 overflow-y-auto"
            style={{ maxHeight: '420px' }}
            dangerouslySetInnerHTML={{ __html: doc.content_html }}
          />
          {!scrolledToEnd && (
            <div className="px-6 py-3 bg-yellow-50 border-t border-yellow-100 text-xs text-yellow-700 text-center">
              Desplázate hasta el final para continuar ↓
            </div>
          )}
        </div>

        {/* Steps */}
        {step === 'read' && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
            <Shield size={32} className="mx-auto text-blue-600 mb-3" />
            <h2 className="font-semibold text-gray-900 mb-2">Verificar identidad</h2>
            <p className="text-sm text-gray-500 mb-5">
              Para firmar este documento, enviaremos un código de verificación a <strong>{candidate.email}</strong>.
            </p>
            <button onClick={() => setStep('otp_send')} disabled={!scrolledToEnd}
              className="w-full bg-blue-700 text-white py-3 rounded-xl text-sm font-medium hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed">
              Continuar
            </button>
            {!scrolledToEnd && (
              <p className="text-xs text-gray-400 mt-2">Lee el documento completo para continuar</p>
            )}
          </div>
        )}

        {step === 'otp_send' && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
            <Mail size={32} className="mx-auto text-blue-600 mb-3" />
            <h2 className="font-semibold text-gray-900 mb-2">Verificar tu correo</h2>
            <p className="text-sm text-gray-500 mb-5">
              Enviaremos un código de 6 dígitos a <strong>{candidate.email}</strong> para confirmar tu identidad.
            </p>
            {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
            <button onClick={sendOtp} disabled={loading}
              className="w-full bg-blue-700 text-white py-3 rounded-xl text-sm font-medium hover:bg-blue-800 disabled:opacity-40">
              {loading ? 'Enviando...' : 'Enviar código'}
            </button>
          </div>
        )}

        {step === 'otp_verify' && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="font-semibold text-gray-900 mb-1 text-center">Ingresa el código</h2>
            <p className="text-sm text-gray-500 text-center mb-5">
              Revisa tu correo <strong>{candidate.email}</strong> e ingresa el código de 6 dígitos.
            </p>
            <input
              value={otpValue}
              onChange={e => setOtpValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-center text-2xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
            />
            {otpError && <p className="text-sm text-red-500 text-center mb-3">{otpError}</p>}
            <button onClick={verifyOtp} disabled={otpValue.length !== 6 || loading}
              className="w-full bg-blue-700 text-white py-3 rounded-xl text-sm font-medium hover:bg-blue-800 disabled:opacity-40">
              {loading ? 'Verificando...' : 'Verificar'}
            </button>
            <button onClick={() => setStep('otp_send')}
              className="w-full mt-2 py-2 text-sm text-gray-400 hover:text-gray-600">
              Reenviar código
            </button>
          </div>
        )}

        {step === 'consent' && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Declaración de consentimiento</h2>
            <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-600 mb-5 leading-relaxed">
              {clause?.content_text}
            </div>
            <label className="flex items-start gap-3 cursor-pointer mb-5">
              <input type="checkbox" checked={consentChecked} onChange={e => setConsentChecked(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-700 focus:ring-blue-500" />
              <span className="text-sm text-gray-700">
                He leído y acepto la declaración de consentimiento anterior. Entiendo que estoy aplicando mi firma electrónica simple.
              </span>
            </label>
            {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
            <button onClick={sign} disabled={!consentChecked || loading}
              className="w-full bg-green-700 text-white py-3 rounded-xl text-sm font-medium hover:bg-green-800 disabled:opacity-40">
              {loading ? 'Firmando...' : '✍️ Firmar documento'}
            </button>
            <p className="text-xs text-gray-400 text-center mt-3">
              Al firmar, se registrará tu identidad verificada, fecha, hora e IP según Ley 19.799.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
