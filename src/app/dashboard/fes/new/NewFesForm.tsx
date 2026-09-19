'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const TEMPLATES: Record<string, string> = {
  carta_oferta: `<h2>Carta de Oferta</h2>
<p>Estimado/a <strong>[NOMBRE_CANDIDATO]</strong>,</p>
<p>Nos complace ofrecerle el cargo de <strong>[CARGO]</strong> en nuestra empresa, con las siguientes condiciones:</p>
<ul>
  <li><strong>Remuneración mensual bruta:</strong> $[MONTO] CLP</li>
  <li><strong>Fecha de inicio:</strong> [FECHA_INICIO]</li>
  <li><strong>Jornada:</strong> 45 horas semanales</li>
  <li><strong>Lugar de trabajo:</strong> [LUGAR]</li>
</ul>
<p>Esta oferta está sujeta a la firma del contrato de trabajo correspondiente y a la verificación de antecedentes.</p>`,
  contrato: `<h2>Contrato de Trabajo</h2>
<p>En [CIUDAD], a [FECHA], entre <strong>[EMPRESA]</strong>, RUT [RUT_EMPRESA], representada por [REPRESENTANTE], en adelante "el Empleador", y <strong>[NOMBRE_CANDIDATO]</strong>, RUT [RUT_TRABAJADOR], en adelante "el Trabajador", se celebra el siguiente contrato de trabajo:</p>
<p><strong>PRIMERO - CARGO:</strong> El Trabajador desempeñará las funciones de [CARGO].</p>
<p><strong>SEGUNDO - REMUNERACIÓN:</strong> El Empleador pagará al Trabajador una remuneración mensual bruta de $[MONTO] CLP.</p>
<p><strong>TERCERO - JORNADA:</strong> La jornada de trabajo será de 45 horas semanales, distribuidas de lunes a viernes.</p>
<p><strong>CUARTO - DURACIÓN:</strong> El presente contrato tendrá duración indefinida, iniciando el [FECHA_INICIO].</p>`,
}

export default function NewFesForm({ candidates }: { candidates: { id: string; full_name: string; email: string }[] }) {
  const [form, setForm] = useState({ candidate_id: '', document_type: 'carta_oferta', title: '', content_html: '' })
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  function handleTypeChange(type: string) {
    setForm(f => ({ ...f, document_type: type, content_html: TEMPLATES[type] ?? '' }))
  }

  async function handleSave() {
    if (!form.candidate_id || !form.title || !form.content_html) return
    setSaving(true)

    const { data: recruiterRow } = await supabase.auth.getUser()

    const { data, error } = await supabase.from('fes_documents').insert({
      recruiter_id: recruiterRow.user!.id,
      candidate_id: form.candidate_id,
      document_type: form.document_type,
      title: form.title,
      content_html: form.content_html,
      status: 'DRAFT',
    }).select('id').single()

    if (!error && data) router.push(`/dashboard/fes/${data.id}`)
    else setSaving(false)
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Candidato</label>
          <select value={form.candidate_id} onChange={e => setForm(f => ({ ...f, candidate_id: e.target.value }))}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Seleccionar candidato...</option>
            {candidates.map(c => (
              <option key={c.id} value={c.id}>{c.full_name} — {c.email}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipo de documento</label>
          <div className="flex gap-3">
            {[{ value: 'carta_oferta', label: 'Carta de oferta' }, { value: 'contrato', label: 'Contrato' }].map(opt => (
              <button key={opt.value} type="button"
                onClick={() => handleTypeChange(opt.value)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                  form.document_type === opt.value
                    ? 'bg-blue-700 text-white border-blue-700'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Título del documento</label>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Ej: Carta de oferta — Analista de Datos"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Contenido del documento</label>
          <p className="text-xs text-gray-400 mb-2">Reemplaza los campos entre corchetes con los datos reales antes de enviar.</p>
          <textarea value={form.content_html}
            onChange={e => setForm(f => ({ ...f, content_html: e.target.value }))}
            rows={14}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={() => router.back()}
          className="flex-1 py-3 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">
          Cancelar
        </button>
        <button onClick={handleSave} disabled={!form.candidate_id || !form.title || !form.content_html || saving}
          className="flex-1 py-3 rounded-xl text-sm font-medium bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed">
          {saving ? 'Guardando...' : 'Guardar borrador'}
        </button>
      </div>
    </div>
  )
}
