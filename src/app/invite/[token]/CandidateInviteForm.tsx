'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Upload, CheckCircle, X, FileText } from 'lucide-react'

const REQUIRED_DOCS = [
  { key: 'curriculum', label: 'Currículum Vitae', desc: 'PDF o Word, máximo 5MB' },
  { key: 'cedula_frontal', label: 'Cédula de identidad (frontal)', desc: 'Imagen o PDF' },
  { key: 'cedula_trasera', label: 'Cédula de identidad (trasera)', desc: 'Imagen o PDF' },
  { key: 'certificado_afp', label: 'Certificado AFP', desc: 'Último certificado de cotizaciones' },
  { key: 'certificado_estudios', label: 'Certificado de estudios', desc: 'Título o certificado de egreso (si aplica)', required: false },
]

type DocStatus = 'idle' | 'uploading' | 'done' | 'error'

export default function CandidateInviteForm({ candidate, token }: { candidate: any; token: string }) {
  const [docStatus, setDocStatus] = useState<Record<string, DocStatus>>({})
  const [docNames, setDocNames] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const supabase = createClient()

  async function handleFileUpload(docKey: string, file: File) {
    setDocStatus(s => ({ ...s, [docKey]: 'uploading' }))
    const ext = file.name.split('.').pop()
    const path = `${candidate.id}/${docKey}_${Date.now()}.${ext}`

    const { error } = await supabase.storage.from('documents').upload(path, file, { upsert: true })
    if (error) { setDocStatus(s => ({ ...s, [docKey]: 'error' })); return }

    const { error: dbErr } = await supabase.from('documents').insert({
      candidate_id: candidate.id,
      document_type: docKey,
      file_name: file.name,
      file_path: path,
      file_size: file.size,
      status: 'PENDING',
    })

    if (dbErr) { setDocStatus(s => ({ ...s, [docKey]: 'error' })); return }
    setDocStatus(s => ({ ...s, [docKey]: 'done' }))
    setDocNames(n => ({ ...n, [docKey]: file.name }))
  }

  async function handleSubmit() {
    setSubmitting(true)
    await supabase.from('candidates').update({ status: 'PENDING_DOCS' }).eq('id', candidate.id)
    setSubmitted(true)
  }

  const mandatoryDocs = REQUIRED_DOCS.filter(d => d.required !== false)
  const allMandatoryUploaded = mandatoryDocs.every(d => docStatus[d.key] === 'done')

  if (submitted) return (
    <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
      <CheckCircle className="mx-auto text-green-500 mb-4" size={48} />
      <h2 className="text-xl font-semibold text-gray-900 mb-2">¡Documentos enviados!</h2>
      <p className="text-gray-500">El equipo de reclutamiento revisará tus documentos y se pondrá en contacto contigo.</p>
    </div>
  )

  return (
    <div className="space-y-4">
      {REQUIRED_DOCS.map(doc => {
        const status = docStatus[doc.key] || 'idle'
        return (
          <div key={doc.key} className={`bg-white rounded-2xl border p-5 transition-colors ${
            status === 'done' ? 'border-green-200 bg-green-50' :
            status === 'error' ? 'border-red-200' : 'border-gray-100'
          }`}>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <FileText size={20} className={status === 'done' ? 'text-green-500 mt-0.5' : 'text-gray-400 mt-0.5'} />
                <div>
                  <p className="font-medium text-gray-900 text-sm">
                    {doc.label}
                    {doc.required === false && <span className="ml-2 text-xs text-gray-400">(opcional)</span>}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{doc.desc}</p>
                  {status === 'done' && <p className="text-xs text-green-600 mt-1">{docNames[doc.key]}</p>}
                  {status === 'error' && <p className="text-xs text-red-500 mt-1">Error al subir. Intenta de nuevo.</p>}
                </div>
              </div>
              <div>
                {status === 'done' ? (
                  <CheckCircle size={20} className="text-green-500" />
                ) : status === 'uploading' ? (
                  <span className="text-xs text-blue-500 animate-pulse">Subiendo...</span>
                ) : (
                  <label className="cursor-pointer flex items-center gap-1.5 bg-blue-700 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-blue-800">
                    <Upload size={13} /> Subir
                    <input type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      onChange={e => { if (e.target.files?.[0]) handleFileUpload(doc.key, e.target.files[0]) }} />
                  </label>
                )}
              </div>
            </div>
          </div>
        )
      })}

      <div className="pt-2">
        <button onClick={handleSubmit} disabled={!allMandatoryUploaded || submitting}
          className="w-full bg-blue-700 text-white py-3 rounded-xl font-medium hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity">
          {submitting ? 'Enviando...' : 'Enviar documentos'}
        </button>
        {!allMandatoryUploaded && (
          <p className="text-xs text-gray-400 text-center mt-2">Sube los documentos obligatorios para continuar</p>
        )}
      </div>
    </div>
  )
}
