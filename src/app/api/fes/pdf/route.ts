import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const service = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const documentId = searchParams.get('id')
  if (!documentId) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify recruiter owns this document
  const { data: doc } = await service
    .from('fes_documents')
    .select('id, title')
    .eq('id', documentId)
    .eq('recruiter_id', user.id)
    .single()

  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Find PDF in storage
  const { data: files } = await service.storage.from('documents').list(`fes/${documentId}`)
  const pdfFile = files?.find(f => f.name.endsWith('.pdf'))
  if (!pdfFile) return NextResponse.json({ error: 'PDF no disponible aún' }, { status: 404 })

  const { data } = await service.storage.from('documents').createSignedUrl(
    `fes/${documentId}/${pdfFile.name}`,
    300,
  )

  if (!data?.signedUrl) return NextResponse.json({ error: 'Error generando URL' }, { status: 500 })

  return NextResponse.redirect(data.signedUrl)
}
