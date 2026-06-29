import type { BehaviorType, ImportInputType, JobStatus } from '@/generated/prisma/client'
import { load } from 'cheerio'
import jsQR from 'jsqr'
import sharp, { type Sharp } from 'sharp'
import { BarcodeFormat, BinaryBitmap, DecodeHintType, HybridBinarizer, MultiFormatReader, RGBLuminanceSource } from '@zxing/library'
import { normalizeProductName, suggestProductBehavior } from '@/lib/domain'

export type ImportErrorCode = 'qr_not_found' | 'invalid_qr' | 'invalid_key' | 'unsupported_state' | 'note_not_found' | 'sefaz_unavailable' | 'invalid_response' | 'already_imported'

export type ImportedReceipt = {
  accessKey: string
  nfceUrl: string
  storeName: string
  storeDocument?: string
  city?: string
  state?: string
  purchaseDate: string
  totalAmount: number
}

export type ImportResult = {
  status: JobStatus
  message: string
  items?: ParsedTextItem[]
  receipt?: ImportedReceipt
  errorCode?: ImportErrorCode
  detectedAccessKey?: string
}

export type ParsedTextItem = {
  rawName: string
  quantity: number
  unitPrice: number
  unit: string
  behaviorType: BehaviorType
}

export interface NotaFiscalImporter {
  readonly inputType: ImportInputType
  import(input: string): Promise<ImportResult>
}

const officialNfceHosts = new Set([
  'www.sefaz.rs.gov.br',
  'sefaz.rs.gov.br',
  'dfe-portal.svrs.rs.gov.br',
])

class ImportFailure extends Error {
  constructor(message: string, public code: ImportErrorCode) {
    super(message)
    this.name = 'ImportFailure'
  }
}

function manualResult(message: string, errorCode: ImportErrorCode, detectedAccessKey?: string): ImportResult {
  return { status: 'requer_acao_manual', message, errorCode, detectedAccessKey }
}

function cleanText(value: string) {
  return value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
}

function decimal(value: string) {
  const normalized = cleanText(value).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
  return Number(normalized)
}

function normalizeUnit(value: string) {
  const unit = cleanText(value).replace(/^UN:\s*/i, '').toUpperCase()
  if (unit === 'KG') return 'kg'
  if (unit === 'G') return 'g'
  if (unit === 'L' || unit === 'LT') return 'L'
  if (unit === 'ML') return 'ml'
  if (unit === 'PCT' || unit === 'PC') return 'pct'
  if (unit === 'CX') return 'cx'
  if (unit === 'DZ') return 'dz'
  return 'un'
}

export function isValidAccessKey(value: string) {
  if (!/^\d{44}$/.test(value)) return false
  let sum = 0
  let weight = 2
  for (let index = 42; index >= 0; index -= 1) {
    sum += Number(value[index]) * weight
    weight = weight === 9 ? 2 : weight + 1
  }
  const remainder = sum % 11
  const digit = remainder < 2 ? 0 : 11 - remainder
  return digit === Number(value[43])
}

export function accessKeyFrom(value: string) {
  const input = value.trim()
  try {
    const url = new URL(input)
    const payload = url.searchParams.get('p') ?? ''
    const match = payload.match(/^(\d{44})(?:\||$)/)
    if (match && isValidAccessKey(match[1])) return match[1]
  } catch {
    // A chave também pode ser digitada sem URL.
  }
  const digits = input.replace(/\D/g, '')
  return isValidAccessKey(digits) ? digits : null
}

function officialUrl(value: string) {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new ImportFailure('O QR Code não contém uma URL válida.', 'invalid_qr')
  }
  if (url.protocol !== 'https:' || !officialNfceHosts.has(url.hostname.toLowerCase())) {
    throw new ImportFailure('O QR Code não aponta para um portal oficial suportado da SEFAZ.', 'invalid_qr')
  }
  return url
}

function urlForAccessKey(key: string) {
  if (!isValidAccessKey(key)) throw new ImportFailure('A chave de acesso da NFC-e é inválida.', 'invalid_key')
  if (!key.startsWith('43')) throw new ImportFailure('A consulta automática por chave está disponível inicialmente para NFC-e do Rio Grande do Sul.', 'unsupported_state')
  return new URL('https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx?p=' + encodeURIComponent(key + '|3|1'))
}

async function fetchOfficialHtml(url: URL) {
  officialUrl(url.toString())
  const response = await fetch(url, {
    headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'PrecoVivo/1.0 NFC-e importer' },
    redirect: 'follow',
    signal: AbortSignal.timeout(25_000),
    cache: 'no-store',
  })
  officialUrl(response.url)
  if (response.status === 404) throw new ImportFailure('A NFC-e não foi encontrada no portal oficial.', 'note_not_found')
  if (!response.ok) throw new ImportFailure('A SEFAZ está indisponível no momento (status ' + response.status + ').', 'sefaz_unavailable')
  const html = await response.text()
  if (!html.includes('tabResult')) throw new ImportFailure('A página oficial não retornou os itens da nota.', 'note_not_found')
  return { html, finalUrl: response.url }
}

export function parseNfceHtml(html: string, sourceUrl: string, knownAccessKey?: string): { receipt: ImportedReceipt; items: ParsedTextItem[] } {
  const $ = load(html)
  const items: ParsedTextItem[] = []
  $('#tabResult tr').each((_index, row) => {
    const firstCell = $(row).find('td').first()
    const rawName = cleanText(firstCell.find('.txtTit').first().text())
    const quantity = decimal(firstCell.find('.Rqtd').text().replace(/Qtde\.:?/i, ''))
    const unitPrice = decimal(firstCell.find('.RvlUnit').text().replace(/Vl\.\s*Unit\.:?/i, ''))
    const unit = normalizeUnit(firstCell.find('.RUN').text())
    if (rawName && Number.isFinite(quantity) && quantity > 0 && Number.isFinite(unitPrice) && unitPrice > 0) {
      items.push({ rawName, quantity, unitPrice, unit, behaviorType: suggestProductBehavior(rawName) })
    }
  })
  if (!items.length) throw new ImportFailure('Nenhum item foi encontrado na consulta oficial.', 'invalid_response')

  const pageText = cleanText($.root().text())
  const key = knownAccessKey ?? accessKeyFrom(sourceUrl)
  if (!key) throw new ImportFailure('A consulta não retornou uma chave de acesso válida.', 'invalid_key')
  const emission = pageText.match(/Emiss[aã]o:\s*(\d{2})\/(\d{2})\/(\d{4})/i)
  const total = decimal($('#totalNota .txtMax').first().text())
  const document = pageText.match(/CNPJ:\s*([\d./-]+)/i)?.[1]
  const address = $('.text').map((_index, element) => cleanText($(element).text())).get().find((text) => /,\s*[A-Z]{2}$/.test(text)) ?? ''
  const addressParts = address.split(',').map((part) => part.trim()).filter(Boolean)
  const state = addressParts.at(-1)?.match(/^[A-Z]{2}$/)?.[0]
  const city = state && addressParts.length > 1 ? addressParts.at(-2) : undefined
  if (!emission || !Number.isFinite(total) || total <= 0) throw new ImportFailure('A data ou o total da NFC-e não pôde ser confirmado.', 'invalid_response')

  return {
    receipt: {
      accessKey: key,
      nfceUrl: sourceUrl,
      storeName: cleanText($('#u20').first().text()) || 'Estabelecimento da NFC-e',
      storeDocument: document,
      city,
      state,
      purchaseDate: emission[3] + '-' + emission[2] + '-' + emission[1],
      totalAmount: total,
    },
    items,
  }
}

async function decodeWithZxing(image: Sharp) {
  try {
    const { data, info } = await image.greyscale().raw().toBuffer({ resolveWithObject: true })
    const source = new RGBLuminanceSource(new Uint8ClampedArray(data), info.width, info.height)
    const bitmap = new BinaryBitmap(new HybridBinarizer(source))
    const hints = new Map<DecodeHintType, unknown>()
    hints.set(DecodeHintType.TRY_HARDER, true)
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE])
    const reader = new MultiFormatReader()
    reader.setHints(hints)
    return reader.decode(bitmap).getText()
  } catch {
    return null
  }
}

async function decodePipeline(image: Sharp) {
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true })
  const rgba = new Uint8ClampedArray(info.width * info.height * 4)
  for (let index = 0; index < info.width * info.height; index += 1) {
    const source = index * info.channels
    const target = index * 4
    if (info.channels <= 2) {
      rgba[target] = data[source]
      rgba[target + 1] = data[source]
      rgba[target + 2] = data[source]
    } else {
      rgba[target] = data[source]
      rgba[target + 1] = data[source + 1]
      rgba[target + 2] = data[source + 2]
    }
    rgba[target + 3] = 255
  }
  return jsQR(rgba, info.width, info.height, { inversionAttempts: 'attemptBoth' })?.data ?? null
}

async function decodeCandidate(candidate: Sharp) {
  const zxing = await decodeWithZxing(candidate.clone().resize(1200, 1200, { fit: 'contain', background: '#ffffff' }))
  if (zxing) return zxing
  for (const angle of [-3, 0, 3]) {
    const base = candidate.clone().rotate(angle, { background: '#ffffff' }).resize(1000, 1000, { fit: 'contain', background: '#ffffff' })
    const plain = await decodePipeline(base.clone().toColourspace('srgb').ensureAlpha())
    if (plain) return plain
    const enhanced = await decodePipeline(base.clone().normalize().sharpen({ sigma: 1.2 }).toColourspace('srgb').ensureAlpha())
    if (enhanced) return enhanced
    for (const threshold of [110, 140, 170]) {
      const decoded = await decodePipeline(base.clone().greyscale().threshold(threshold))
      if (decoded) return decoded
    }
  }
  return null
}

export async function decodeQrFromImage(path: string) {
  const oriented = await sharp(path).rotate().toBuffer()
  const metadata = await sharp(oriented).metadata()
  if (!metadata.width || !metadata.height) throw new ImportFailure('A imagem enviada não pôde ser aberta.', 'qr_not_found')
  const full = await decodeCandidate(sharp(oriented).resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true }))
  if (full) return full

  const minimum = Math.min(metadata.width, metadata.height)
  const candidates: { x: number; y: number; size: number }[] = [
    { x: 0.5, y: 0.5, size: 0.35 },
    { x: 0.45, y: 0.54, size: 0.3 },
    { x: 0.5, y: 0.6, size: 0.4 },
    { x: 0.35, y: 0.5, size: 0.35 },
    { x: 0.65, y: 0.5, size: 0.35 },
  ]
  const seen = new Set(candidates.map((candidate) => [candidate.x, candidate.y, candidate.size].join(':')))
  for (const scale of [0.28, 0.4, 0.55]) {
    const size = minimum * scale
    const horizontalSteps = Math.max(1, Math.ceil((metadata.width - size) / (size * 0.62)))
    const verticalSteps = Math.max(1, Math.ceil((metadata.height - size) / (size * 0.62)))
    for (let column = 0; column <= horizontalSteps; column += 1) {
      for (let row = 0; row <= verticalSteps; row += 1) {
        const x = (size / 2 + (metadata.width - size) * (column / horizontalSteps)) / metadata.width
        const y = (size / 2 + (metadata.height - size) * (row / verticalSteps)) / metadata.height
        const key = [x.toFixed(3), y.toFixed(3), scale].join(':')
        if (!seen.has(key)) { seen.add(key); candidates.push({ x, y, size: scale }) }
      }
    }
  }
  for (const candidate of candidates) {
    const size = Math.min(Math.round(minimum * candidate.size), metadata.width, metadata.height)
    const left = Math.max(0, Math.min(metadata.width - size, Math.round(metadata.width * candidate.x - size / 2)))
    const top = Math.max(0, Math.min(metadata.height - size, Math.round(metadata.height * candidate.y - size / 2)))
    const decoded = await decodeCandidate(sharp(oriented).extract({ left, top, width: size, height: size }))
    if (decoded) return decoded
  }
  throw new ImportFailure('Não foi possível encontrar o QR Code. Aproxime a câmera, mostre o código inteiro e evite reflexos.', 'qr_not_found')
}

export class NfceUrlImporter implements NotaFiscalImporter {
  readonly inputType = 'nfce_url' as const

  async import(input: string): Promise<ImportResult> {
    const detectedAccessKey = accessKeyFrom(input) ?? undefined
    try {
      const url = officialUrl(input)
      const key = detectedAccessKey
      if (!key) throw new ImportFailure('O QR Code não contém uma chave de acesso válida.', 'invalid_key')
      const { html, finalUrl } = await fetchOfficialHtml(url)
      const parsed = parseNfceHtml(html, finalUrl, key)
      return { status: 'concluida', message: String(parsed.items.length) + ' itens importados da SEFAZ.', ...parsed }
    } catch (error) {
      const code = error instanceof ImportFailure ? error.code : 'sefaz_unavailable'
      return manualResult(error instanceof Error ? error.message : 'Não foi possível consultar a NFC-e.', code, detectedAccessKey)
    }
  }
}

export class AccessKeyImporter implements NotaFiscalImporter {
  readonly inputType = 'access_key' as const

  async import(input: string): Promise<ImportResult> {
    try {
      const key = accessKeyFrom(input)
      if (!key) throw new ImportFailure('Informe uma chave de acesso válida com 44 dígitos.', 'invalid_key')
      return new NfceUrlImporter().import(urlForAccessKey(key).toString())
    } catch (error) {
      const code = error instanceof ImportFailure ? error.code : 'sefaz_unavailable'
      return manualResult(error instanceof Error ? error.message : 'Não foi possível consultar a chave.', code, accessKeyFrom(input) ?? undefined)
    }
  }
}

export class ImageOcrImporter implements NotaFiscalImporter {
  readonly inputType = 'image' as const

  async import(input: string): Promise<ImportResult> {
    try {
      const qrUrl = await decodeQrFromImage(input)
      return new NfceUrlImporter().import(qrUrl)
    } catch (error) {
      const code = error instanceof ImportFailure ? error.code : 'qr_not_found'
      return manualResult(error instanceof Error ? error.message : 'Não foi possível ler o QR Code da foto.', code)
    }
  }
}

class ManualRequiredImporter implements NotaFiscalImporter {
  readonly inputType = 'pdf' as const
  async import(input: string): Promise<ImportResult> {
    void input
    return manualResult('A leitura automática de PDF ainda não está disponível. Envie uma foto nítida do QR Code.', 'qr_not_found')
  }
}

export class PdfImporter extends ManualRequiredImporter {}

export class ManualTextImporter implements NotaFiscalImporter {
  readonly inputType = 'raw_text' as const

  async import(input: string): Promise<ImportResult> {
    const lines = input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    if (!lines.length) return { status: 'erro', message: 'Cole ao menos um item.' }

    try {
      const items = lines.map((line, index) => {
        const [rawName, quantityRaw, unitPriceRaw, unit = 'un'] = line.split(/[|;]/).map((part) => part.trim())
        const quantity = Number(quantityRaw?.replace(',', '.'))
        const unitPrice = Number(unitPriceRaw?.replace(/R\$/gi, '').replace(',', '.'))
        if (!rawName || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice <= 0) {
          throw new Error('Linha ' + String(index + 1) + ': use Produto | quantidade | preço unitário | unidade')
        }
        return { rawName, quantity, unitPrice, unit, behaviorType: suggestProductBehavior(rawName) }
      })
      return { status: 'concluida', message: String(items.length) + ' itens lidos do texto.', items }
    } catch (error) {
      return { status: 'erro', message: error instanceof Error ? error.message : 'Não foi possível ler o texto.' }
    }
  }
}

export function importerFor(type: ImportInputType): NotaFiscalImporter {
  if (type === 'access_key') return new AccessKeyImporter()
  if (type === 'nfce_url' || type === 'qr_code_url') return new NfceUrlImporter()
  if (type === 'image') return new ImageOcrImporter()
  if (type === 'pdf') return new PdfImporter()
  return new ManualTextImporter()
}

export { normalizeProductName }
