'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Send, CheckCircle, Clock, FileText, ExternalLink, Hash, Download, Shield } from 'lucide-react'

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Borrador', SENT: 'Enviado', VIEWED: 'Visto',
  SIGNED: 'Firmado', EXPIRED: 'Expirado', CANCELLED: 'Cancelado',
}
const TYPE_LABEL: Record<string, string> = {
  carta_oferta: 'Carta de oferta', contrato: 'Contrato',
}
const EVENT_LABEL: Record<string, string> = {
  document_created: 'Documento creado',
  document_sent: 'Enviado al candidato',
  document_viewed: 'Visto por el candidato',
  otp_sent: 'Código OTP enviado',
  otp_verified: 'Código OTP verificado',
  consent_accepted: 'Consentimiento aceptado',
  document_signed: 'Documento firmado',
  document_expired: 'Documento expirado',
  document_cancelled: 'Documento cancelado',
  tsa_stamped: 'Sello de tiempo aplicado',
}

export default function FesDocumentDetail({ doc, events, signature }: { doc: any; events: any[]; signature: any }) {
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const router = useRouter()
  const candidate = doc.candidates as any
  const signingUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/fes/${doc.invite_token}`

  async function handleSend() {
    setSending(true)
    try {
      const res = await fetch('/api/fes/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: doc.id }),
      })
      if (res.ok) {
        setSent(true)
        router.refresh()
      } else {
        const body = await res.json().catch(() => ({}))
        alert(`Error al enviar: ${body.error ?? res.statusText}`)
      }
    } catch (e: any) {
      alert(`Error de red: ${e.message}`)
    }
    setSending(false)
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{doc.title}</h1>
          <p className="text-sm text-gray-400 mt-1">
            {TYPE_LABEL[doc.document_type]} · {candidate?.full_name}
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
          doc.status === 'SIGNED' ? 'bg-green-50 text-green-700' :
          doc.status === 'SENT' || doc.status === 'VIEWED' ? 'bg-blue-50 text-blue-700' :
          'bg-gray-100 text-gray-600'
        }`}>
          {STATUS_LABEL[doc.status]}
        </span>
      </div>

      {/* Content preview */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-sm font-medium text-gray-700 mb-4 flex items-center gap-2">
          <FileText size={15} className="text-gray-400" /> Contenido del documento
        </h2>
        <div className="prose prose-sm max-w-none text-gray-700 border border-gray-100 rounded-xl p-5 bg-gray-50"
          dangerouslySetInnerHTML={{ __html: doc.content_html }} />
        {doc.content_hash && (
          <p className="text-xs text-gray-400 mt-3 flex items-center gap-1.5">
            <Hash size={11} /> SHA-256: <code className="font-mono">{doc.content_hash.slice(0, 16)}…</code>
          </p>
        )}
      </div>

      {/* Signature info */}
      {signature && (
        <div className="bg-green-50 border border-green-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={16} className="text-green-600" />
            <h2 className="text-sm font-medium text-green-800">Documento firmado</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs text-green-700">
            <div><span className="opacity-60">Firmante:</span> {signature.signer_name}</div>
            <div><span className="opacity-60">Email:</span> {signature.signer_email}</div>
            <div><span className="opacity-60">IP:</span> {signature.ip_address ?? '—'}</div>
            <div><span className="opacity-60">OTP verificado:</span> {signature.otp_verified_at ? new Date(signature.otp_verified_at).toLocaleString('es-CL') : '—'}</div>
            <div><span className="opacity-60">Firmado:</span> {signature.signed_at ? new Date(signature.signed_at).toLocaleString('es-CL') : '—'}</div>
            {signature.manifest_hash && (
              <div className="col-span-2"><span className="opacity-60">Hash manifiesto:</span> <code className="font-mono">{signature.manifest_hash.slice(0, 20)}…</code></div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      {doc.status === 'DRAFT' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Enviar al candidato</h2>
          <p className="text-sm text-gray-500 mb-4">
            Al enviar, el contenido del documento quedará congelado (no editable) y se calculará su hash SHA-256. Se enviará un email a <strong>{candidate?.email}</strong> con el enlace para firmar.
          </p>
          <button onClick={handleSend} disabled={sending || sent}
            className="flex items-center gap-2 bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-800 disabled:opacity-40">
            <Send size={15} />
            {sending ? 'Enviando...' : sent ? '¡Enviado!' : 'Enviar para firma'}
          </button>
        </div>
      )}

      {(doc.status === 'SENT' || doc.status === 'VIEWED') && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="text-sm font-medium text-gray-700 mb-2">Enlace de firma</h2>
          <div className="flex items-center gap-2">
            <code className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 flex-1 truncate">
              {signingUrl}
            </code>
            <a href={signingUrl} target="_blank"
              className="p-2 text-gray-400 hover:text-blue-700 rounded-lg hover:bg-blue-50">
              <ExternalLink size={15} />
            </a>
          </div>
        </div>
      )}

      {/* Signed actions */}
      {doc.status === 'SIGNED' && (
        <div className="flex gap-3">
          <a href={`/api/fes/pdf?id=${doc.id}`}
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">
            <Download size={15} /> Descargar PDF firmado
          </a>
          <a href={`/verificar/${signature?.manifest_hash}`} target="_blank"
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">
            <Shield size={15} /> Verificar autenticidad
          </a>
        </div>
      )}

      {/* Audit trail */}
      {events.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="text-sm font-medium text-gray-700 mb-4">Cadena de auditoría</h2>
          <div className="space-y-2">
            {events.map((ev, i) => (
              <div key={ev.id} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5" />
                  {i < events.length - 1 && <div className="w-px h-full bg-gray-100 mt-1" />}
                </div>
                <div className="pb-3">
                  <p className="text-sm text-gray-800">{EVENT_LABEL[ev.event_type] ?? ev.event_type}</p>
                  <p className="text-xs text-gray-400">{new Date(ev.created_at).toLocaleString('es-CL')}</p>
                  {ev.event_hash && (
                    <p className="text-xs text-gray-300 font-mono mt-0.5">{ev.event_hash.slice(0, 20)}…</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
