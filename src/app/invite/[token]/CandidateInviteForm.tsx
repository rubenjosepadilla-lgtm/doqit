'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Upload, CheckCircle, Clock, X, FileText, AlertCircle } from 'lucide-react'

const REQUIRED_DOCS = [
  { key: 'curriculum', label: 'Currículum Vitae', desc: 'PDF o Word, máximo 5MB' },
  { key: 'cedula_frontal', label: 'Cédula de identidad (frontal)', desc: 'Imagen o PDF' },
  { key: 'cedula_trasera', label: 'Cédula de identidad (trasera)', desc: 'Imagen o PDF' },
  { key: 'certificado_afp', label: 'Certificado AFP', desc: 'Último certificado de cotizaciones' },
  { key: 'certificado_estudios', label: 'Certificado de estudios', desc: 'Título o certificado de egreso (si aplica)', required: false },
]

type UploadStatus = 'idle' | 'uploading' | 'done' | 'error'

type ExistingDoc = {
  id: string
  document_type: string
  file_name: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  rejection_reason: string | null
}

export default function CandidateInviteForm({
  candidate,
  token,
  existingDocs,
}: {
  candidate: any
  token: string
  existingDocs: ExistingDoc[]
}) {
  const existingByType = Object.fromEntries(existingDocs.map(d => [d.document_type, d]))

  const [uploadStatus, setUploadStatus] = useState<Record<string, UploadStatus>>({})
  const [uploadedNames, setUploadedNames] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const supabase = createClient()

  async function handleFileUpload(docKey: string, file: File) {
    setUploadStatus(s => ({ ...s, [docKey]: 'uploading' }))
    const ext = file.name.split('.').pop()
    const path = `${candidate.id}/${docKey}_${Date.now()}.${ext}`

    const { error: storageErr } = await supabase.storage.from('documents').upload(path, file, { upsert: true })
    if (storageErr) { setUploadStatus(s => ({ ...s, [docKey]: 'error' })); return }

    const existing = existingByType[docKey]
    if (existing) {
      const { error } = await supabase.from('documents').update({
        file_name: file.name,
        file_path: path,
        file_size: file.size,
        status: 'PENDING',
        rejection_reason: null,
        reviewed_by: null,
        reviewed_at: null,
      }).eq('id', existing.id)
      if (error) { setUploadStatus(s => ({ ...s, [docKey]: 'error' })); return }
      existingByType[docKey] = { ...existing, file_name: file.name, status: 'PENDING', rejection_reason: null }
    } else {
      const { error } = await supabase.from('documents').insert({
        candidate_id: candidate.id,
        document_type: docKey,
        file_name: file.name,
        file_path: path,
        file_size: file.size,
        status: 'PENDING',
      })
      if (error) { setUploadStatus(s => ({ ...s, [docKey]: 'error' })); return }
    }

    setUploadStatus(s => ({ ...s, [docKey]: 'done' }))
    setUploadedNames(n => ({ ...n, [docKey]: file.name }))
  }

  async function handleSubmit() {
    setSubmitting(true)
    await supabase.from('candidates').update({ status: 'PENDING_DOCS' }).eq('id', candidate.id)
    setSubmitted(true)
  }

  const hasRejected = existingDocs.some(d => d.status === 'REJECTED')
  const mandatoryDocs = REQUIRED_DOCS.filter(d => d.required !== false)

  function isDocReady(docKey: string) {
    if (uploadStatus[docKey] === 'done') return true
    const ex = existingByType[docKey]
    return ex && ex.status !== 'REJECTED'
  }

  const allMandatoryReady = mandatoryDocs.every(d => isDocReady(d.key))

  if (submitted) return (
    <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
      <CheckCircle className="mx-auto text-green-500 mb-4" size={48} />
      <h2 className="text-xl font-semibold text-gray-900 mb-2">¡Documentos enviados!</h2>
      <p className="text-gray-500">El equipo de reclutamiento revisará tus documentos y se pondrá en contacto contigo.</p>
    </div>
  )

  return (
    <div className="space-y-4">
      {hasRejected && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700">
          Algunos documentos fueron rechazados. Por favor vuelve a subirlos.
        </div>
      )}

      {REQUIRED_DOCS.map(doc => {
        const uploadSt = uploadStatus[doc.key]
        const existing = existingByType[doc.key]

        let borderColor = 'border-gray-100'
        let bgColor = ''
        if (uploadSt === 'done' || (existing && existing.status === 'APPROVED')) {
          borderColor = 'border-green-200'; bgColor = 'bg-green-50'
        } else if (existing?.status === 'REJECTED') {
          borderColor = 'border-red-200'; bgColor = 'bg-red-50'
        } else if (existing?.status === 'PENDING') {
          borderColor = 'border-yellow-200'; bgColor = 'bg-yellow-50'
        }

        const showFileName = uploadSt === 'done'
          ? uploadedNames[doc.key]
          : existing?.file_name

        return (
          <div key={doc.key} className={`bg-white rounded-2xl border p-5 transition-colors ${borderColor} ${bgColor}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <FileText size={20} className="text-gray-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 text-sm">
                    {doc.label}
                    {doc.required === false && <span className="ml-2 text-xs text-gray-400">(opcional)</span>}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{doc.desc}</p>
                  {showFileName && <p className="text-xs text-gray-500 mt-1 truncate">{showFileName}</p>}
                  {existing?.status === 'REJECTED' && existing.rejection_reason && (
                    <p className="text-xs text-red-600 mt-1">Rechazado: {existing.rejection_reason}</p>
                  )}
                  {uploadSt === 'error' && <p className="text-xs text-red-500 mt-1">Error al subir. Intenta de nuevo.</p>}
                </div>
              </div>

              <div className="shrink-0">
                {uploadSt === 'uploading' ? (
                  <span className="text-xs text-blue-500 animate-pulse">Subiendo...</span>
                ) : uploadSt === 'done' || existing?.status === 'APPROVED' ? (
                  <CheckCircle size={20} className="text-green-500" />
                ) : existing?.status === 'PENDING' ? (
                  <div className="flex items-center gap-1.5">
                    <Clock size={16} className="text-yellow-500" />
                    <span className="text-xs text-yellow-600">En revisión</span>
                  </div>
                ) : (
                  <label className="cursor-pointer flex items-center gap-1.5 bg-blue-700 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-blue-800">
                    <Upload size={13} />
                    {existing?.status === 'REJECTED' ? 'Volver a subir' : 'Subir'}
                    <input type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      onChange={e => { if (e.target.files?.[0]) handleFileUpload(doc.key, e.target.files[0]) }} />
                  </label>
                )}
              </div>
            </div>
          </div>
        )
      })}

      {(hasRejected || existingDocs.length === 0) && (
        <div className="pt-2">
          <button onClick={handleSubmit} disabled={!allMandatoryReady || submitting}
            className="w-full bg-blue-700 text-white py-3 rounded-xl font-medium hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity">
            {submitting ? 'Enviando...' : hasRejected ? 'Reenviar documentos' : 'Enviar documentos'}
          </button>
          {!allMandatoryReady && (
            <p className="text-xs text-gray-400 text-center mt-2">Sube los documentos obligatorios para continuar</p>
          )}
        </div>
      )}
    </div>
  )
}
