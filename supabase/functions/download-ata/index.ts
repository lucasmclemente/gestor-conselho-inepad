import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { PDFDocument, StandardFonts, rgb, degrees } from "https://esm.sh/pdf-lib@1.17.1"

const ALLOWED_ORIGINS = [
  'https://conselho.inepadconsulting.com',
  'http://localhost:3000',
]
function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const isVercelPreview = /^https:\/\/gestor-conselho-in[a-z0-9-]*\.vercel\.app$/.test(origin)
  const allowed = ALLOWED_ORIGINS.includes(origin) || isVercelPreview ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  }
}

// Mantém apenas caracteres Latin-1 (suportados pela fonte padrão do PDF)
const latin1 = (s: string) => String(s ?? '').replace(/[^\x20-\xFF]/g, '')

function toBase64(bytes: Uint8Array): string {
  let bin = ''
  const chunk = 8192
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
  return btoa(bin)
}

serve(async (req) => {
  const cors = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const json = (b: object, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
  if (authError || !user) return json({ error: 'Unauthorized' }, 401)

  const name = (user.user_metadata as any)?.name || user.email || 'Usuário'
  const email = user.email || ''

  try {
    const { url } = await req.json()
    if (!url || typeof url !== 'string') return json({ error: 'URL do arquivo ausente.' }, 400)

    // Extrai o caminho no Storage e baixa via service role (confiável, sem depender de URL assinada)
    const match = url.match(/\/(?:sign|public)\/meeting-files\/(.+?)(?:\?|$)/)
    if (!match) return json({ error: 'Arquivo inválido.' }, 400)
    const path = decodeURIComponent(match[1])

    // Isolamento de tenant: o path é <tipo>/<client_id>/... — só o próprio tenant baixa (fecha IDOR cross-tenant)
    const role = (user.app_metadata as any)?.role ?? ''
    const homeClient = (user.app_metadata as any)?.client_id ?? null
    const secClients: string[] = Array.isArray((user.app_metadata as any)?.secretary_clients) ? (user.app_metadata as any).secretary_clients : []
    const fileClient = path.split('/')[1]
    if (!(role === 'SuperAdmin' || (fileClient && (fileClient === homeClient || secClients.includes(fileClient))))) {
      return json({ error: 'Sem permissão para este arquivo.' }, 403)
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: file, error: dlErr } = await admin.storage.from('meeting-files').download(path)
    if (dlErr || !file) return json({ error: 'Arquivo não encontrado no servidor.' }, 404)
    const srcBytes = new Uint8Array(await file.arrayBuffer())

    // Aplica a marca d'água
    const pdfDoc = await PDFDocument.load(srcBytes, { ignoreEncryption: true })
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const when = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    const line1 = latin1(`${name}  |  ${email}`)
    const line2 = latin1(`Baixado em ${when} (horario de Brasilia)`)

    for (const page of pdfDoc.getPages()) {
      const { width, height } = page.getSize()
      const step = 230
      for (let y = -40; y < height + 60; y += step) {
        for (let x = -40; x < width + 60; x += step) {
          page.drawText(line1, { x, y, size: 9, font, color: rgb(0.55, 0.55, 0.55), opacity: 0.16, rotate: degrees(30) })
        }
      }
      // Rodapé identificador
      page.drawText(line1, { x: 16, y: 22, size: 7, font, color: rgb(0.4, 0.4, 0.4), opacity: 0.85 })
      page.drawText(line2, { x: 16, y: 12, size: 7, font, color: rgb(0.4, 0.4, 0.4), opacity: 0.85 })
    }

    const outBytes = await pdfDoc.save()
    return json({ success: true, pdf_base64: toBase64(outBytes) })
  } catch (e: any) {
    return json({ error: e.message }, 400)
  }
})
