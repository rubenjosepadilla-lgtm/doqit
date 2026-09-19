import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, FileText, Clock, CheckCircle, XCircle, Send } from 'lucide-react'

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  DRAFT:     { label: 'Borrador',  color: 'text-gray-500 bg-gray-50',    icon: FileText },
  SENT:      { label: 'Enviado',   color: 'text-blue-600 bg-blue-50',    icon: Send },
  VIEWED:    { label: 'Visto',     color: 'text-yellow-600 bg-yellow-50', icon: Clock },
  SIGNED:    { label: 'Firmado',   color: 'text-green-600 bg-green-50',  icon: CheckCircle },
  EXPIRED:   { label: 'Expirado', color: 'text-red-500 bg-red-50',      icon: XCircle },
  CANCELLED: { label: 'Cancelado', color: 'text-red-500 bg-red-50',     icon: XCircle },
}

const TYPE_LABEL: Record<string, string> = {
  carta_oferta: 'Carta de oferta',
  contrato: 'Contrato',
}

export default async function FesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: docs } = await supabase
    .from('fes_documents')
    .select('*, candidates(full_name, email)')
    .eq('recruiter_id', user!.id)
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Firma Electrónica</h1>
          <p className="text-sm text-gray-400 mt-1">Cartas de oferta y contratos con FES (Ley 19.799)</p>
        </div>
        <Link href="/dashboard/fes/new"
          className="flex items-center gap-2 bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-800">
          <Plus size={16} /> Nuevo documento
        </Link>
      </div>

      {!docs?.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
          <FileText size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium text-gray-500">Sin documentos FES aún</p>
          <p className="text-sm mt-1">Crea una carta de oferta o contrato para comenzar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {docs.map(doc => {
            const s = STATUS_MAP[doc.status] ?? STATUS_MAP.DRAFT
            const Icon = s.icon
            const candidate = doc.candidates as any
            return (
              <Link key={doc.id} href={`/dashboard/fes/${doc.id}`}
                className="block bg-white rounded-2xl border border-gray-100 p-5 hover:border-blue-100 hover:shadow-sm transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText size={18} className="text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{doc.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {TYPE_LABEL[doc.document_type]} · {candidate?.full_name ?? '—'}
                      </p>
                    </div>
                  </div>
                  <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${s.color}`}>
                    <Icon size={12} />
                    {s.label}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
