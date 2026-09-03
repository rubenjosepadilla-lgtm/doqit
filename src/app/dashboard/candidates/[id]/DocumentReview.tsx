'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, XCircle, FileText, ExternalLink } from 'lucide-react'
import { useRouter } from 'next/navigation'

const DOC_LABELS: Record<string, string> = {
  curriculum: 'Currículum Vitae',
  cedula_frontal: 'Cédula (frontal)',
  cedula_trasera: 'Cédula (trasera)',
  certificado_afp: 'Certificado AFP',
  certificado_estudios: 'Certificado de estudios',
}

export default function DocumentReview({ documents, candidateId }: { documents: any[]; candidateId: string }) {
  const [docs, setDocs] = useState(documents)
  const [loading, setLoading] = useState<string | null>(null)
  const supabase = createClient()
  const router = useRouter()

  async function updateDoc(docId: string, status: 'APPROVED' | 'REJECTED', reason?: string) {
    setLoading(docId)
    await supabase.from('documents').update({
      status,
      rejection_reason: reason || null,
      reviewed_at: new Date().toISOString(),
    }).eq('id', docId)

    setDocs(d => d.map(doc => doc.id === docId ? { ...doc, status, rejection_reason: reason } : doc))
    setLoading(null)

    // Check if all docs approved → update candidate status
    const updated = docs.map(doc => doc.id === docId ? { ...doc, status } : doc)
    if (updated.every(d => d.status === 'APPROVED')) {
      await supabase.from('candidates').update({ status: 'READY' }).eq('id', candidateId)
      router.refresh()
    }
  }

  async function getFileUrl(path: string) {
    const { data } = await supabase.storage.from('documents').createSignedUrl(path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  const statusBadge = (status: string) => {
    if (status === 'APPROVED') return <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Aprobado</span>
    if (status === 'REJECTED') return <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Rechazado</span>
    return <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">Pendiente</span>
  }

  return (
    <div className="space-y-3">
      {docs.map(doc => (
        <div key={doc.id} className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText size={18} className="text-gray-400" />
              <div>
                <p className="font-medium text-gray-900 text-sm">{DOC_LABELS[doc.document_type] ?? doc.document_type}</p>
                <p className="text-xs text-gray-400">{doc.file_name}</p>
                {doc.rejection_reason && <p className="text-xs text-red-500 mt-0.5">{doc.rejection_reason}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {statusBadge(doc.status)}
              <button onClick={() => getFileUrl(doc.file_path)}
                className="p-1.5 text-gray-400 hover:text-blue-700 rounded-lg hover:bg-blue-50">
                <ExternalLink size={15} />
              </button>
              {doc.status === 'PENDING' && (
                <>
                  <button disabled={loading === doc.id} onClick={() => updateDoc(doc.id, 'APPROVED')}
                    className="p-1.5 text-gray-400 hover:text-green-600 rounded-lg hover:bg-green-50 disabled:opacity-40">
                    <CheckCircle size={18} />
                  </button>
                  <button disabled={loading === doc.id}
                    onClick={() => {
                      const reason = prompt('Motivo de rechazo (opcional):') ?? ''
                      updateDoc(doc.id, 'REJECTED', reason)
                    }}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-40">
                    <XCircle size={18} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
