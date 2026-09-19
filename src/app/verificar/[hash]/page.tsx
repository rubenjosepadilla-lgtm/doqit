import { createClient } from '@supabase/supabase-js'
import { CheckCircle, XCircle, Shield, Hash, Clock } from 'lucide-react'

const service = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export default async function VerificarPage({ params }: { params: Promise<{ hash: string }> }) {
  const { hash } = await params

  const { data: sig } = await service
    .from('fes_signatures')
    .select('*, fes_documents(id, title, document_type, content_hash, signed_at, fes_clauses(version))')
    .eq('manifest_hash', hash)
    .maybeSingle()

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <span className="text-2xl font-bold text-blue-700">Doqit</span>
          <p className="text-sm text-gray-400 mt-1">Verificador de documentos · Ley 19.799</p>
        </div>

        {sig ? (
          <div className="bg-white rounded-2xl border border-green-200 shadow-sm overflow-hidden">
            <div className="bg-green-50 px-6 py-5 flex items-center gap-3 border-b border-green-100">
              <CheckCircle className="text-green-600 shrink-0" size={28} />
              <div>
                <h1 className="font-semibold text-green-800">Documento verificado</h1>
                <p className="text-sm text-green-600">La firma electrónica es auténtica y válida</p>
              </div>
            </div>

            <div className="px-6 py-5 space-y-4">
              {[
                { label: 'Documento', value: (sig.fes_documents as any)?.title },
                { label: 'Tipo', value: (sig.fes_documents as any)?.document_type === 'carta_oferta' ? 'Carta de oferta' : 'Contrato' },
                { label: 'Firmante', value: sig.signer_name },
                { label: 'Correo', value: sig.signer_email },
                { label: 'Firmado el', value: sig.signed_at ? new Date(sig.signed_at).toLocaleString('es-CL') : '—' },
                { label: 'OTP verificado', value: sig.otp_verified_at ? new Date(sig.otp_verified_at).toLocaleString('es-CL') : '—' },
                { label: 'Cláusula', value: sig.clause_version },
                ...(sig.tsa_provider ? [
                  { label: 'Sello de tiempo', value: `${sig.tsa_provider} · ${sig.tsa_timestamp ? new Date(sig.tsa_timestamp).toLocaleString('es-CL') : '—'}` },
                ] : []),
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-start gap-4">
                  <span className="text-sm text-gray-500 shrink-0">{label}</span>
                  <span className="text-sm text-gray-900 text-right">{value ?? '—'}</span>
                </div>
              ))}

              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Hash size={11} /> Hash del manifiesto</p>
                <code className="text-xs font-mono text-gray-500 break-all">{hash}</code>
              </div>

              {(sig.fes_documents as any)?.content_hash && (
                <div>
                  <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Hash size={11} /> Hash del contenido (SHA-256)</p>
                  <code className="text-xs font-mono text-gray-500 break-all">{(sig.fes_documents as any).content_hash}</code>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Shield size={12} />
                Firma Electrónica Simple válida conforme a la Ley 19.799 — República de Chile
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-red-200 shadow-sm overflow-hidden">
            <div className="bg-red-50 px-6 py-5 flex items-center gap-3 border-b border-red-100">
              <XCircle className="text-red-500 shrink-0" size={28} />
              <div>
                <h1 className="font-semibold text-red-800">Documento no encontrado</h1>
                <p className="text-sm text-red-500">No se encontró ningún documento con este hash</p>
              </div>
            </div>
            <div className="px-6 py-5">
              <p className="text-xs text-gray-400 mb-1">Hash consultado:</p>
              <code className="text-xs font-mono text-gray-500 break-all">{hash}</code>
              <p className="text-sm text-gray-500 mt-4">
                Este hash no corresponde a ningún documento firmado en Doqit. Verifica que el enlace sea correcto.
              </p>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">
          Doqit · <a href="https://doqit.vercel.app" className="hover:text-gray-600">doqit.vercel.app</a>
        </p>
      </div>
    </div>
  )
}
