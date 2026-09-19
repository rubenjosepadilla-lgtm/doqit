import { Resend } from 'resend'
import { NextResponse } from 'next/server'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  const { type, to, data } = await req.json()

  let subject = ''
  let html = ''

  if (type === 'docs_submitted') {
    subject = `${data.candidateName} subió sus documentos`
    html = `
      <p>Hola,</p>
      <p><strong>${data.candidateName}</strong> (${data.candidateEmail}) acaba de enviar sus documentos para la posición <strong>${data.position}</strong>.</p>
      <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/candidates/${data.candidateId}" style="background:#1d4ed8;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:8px;">Revisar documentos</a></p>
      <p style="color:#9ca3af;font-size:12px;margin-top:24px;">Doqit — Gestión documental para reclutamiento</p>
    `
  } else if (type === 'doc_reviewed') {
    const approved = data.status === 'APPROVED'
    subject = approved
      ? `Tu documento "${data.docLabel}" fue aprobado`
      : `Tu documento "${data.docLabel}" fue rechazado`
    html = `
      <p>Hola ${data.candidateName},</p>
      ${approved
        ? `<p>Tu documento <strong>${data.docLabel}</strong> fue <span style="color:#16a34a">aprobado</span>. ✅</p>`
        : `<p>Tu documento <strong>${data.docLabel}</strong> fue <span style="color:#dc2626">rechazado</span>. ❌</p>
           ${data.reason ? `<p>Motivo: <em>${data.reason}</em></p>` : ''}
           <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/invite/${data.token}" style="background:#1d4ed8;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:8px;">Volver a subir documento</a></p>`
      }
      <p style="color:#9ca3af;font-size:12px;margin-top:24px;">Doqit — Gestión documental para reclutamiento</p>
    `
  }

  try {
    await resend.emails.send({
      from: 'Doqit <onboarding@resend.dev>',
      to,
      subject,
      html,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Email error:', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
