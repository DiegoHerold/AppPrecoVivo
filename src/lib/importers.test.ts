import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { BarcodeFormat, QRCodeWriter } from '@zxing/library'
import sharp from 'sharp'
import { AccessKeyImporter, accessKeyFrom, decodeQrFromImage, isValidAccessKey, ManualTextImporter, parseNfceHtml } from './importers'
import { pendingImportSchema } from './validation'

test('texto manual vira itens reais sem inventar linhas', async () => {
  const result = await new ManualTextImporter().import('Leite integral | 2 | 4,89 | un')
  assert.equal(result.status, 'concluida')
  assert.deepEqual(result.items?.[0], {
    rawName: 'Leite integral', quantity: 2, unitPrice: 4.89, unit: 'un', behaviorType: 'recorrente_semanal',
  })
})

test('chave inválida não consulta nem inventa itens', async () => {
  const result = await new AccessKeyImporter().import('1'.repeat(44))
  assert.equal(result.status, 'requer_acao_manual')
  assert.match(result.message, /válida/)
})

test('valida a chave e extrai do QR Code da NFC-e', () => {
  const key = '43260607718633002041650020008588731426827342'
  assert.equal(isValidAccessKey(key), true)
  assert.equal(accessKeyFrom('https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx?p=' + key + '|3|1'), key)
})

test('importação fiscal aceita somente o valor textual, sem imagem ou fileUrl', () => {
  const inputValue = 'https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx?p=43260607718633002041650020008588731426827342|3|1'
  assert.equal(pendingImportSchema.safeParse({ inputType: 'qr_code_url', inputValue, purchaseDate: '2026-06-30' }).success, true)
  assert.equal(pendingImportSchema.safeParse({ inputType: 'image', inputValue: '/api/uploads/abc', purchaseDate: '2026-06-30' }).success, false)
})

test('lê os itens retornados pela página oficial sem criar dados fictícios', () => {
  const key = '43260607718633002041650020008588731426827342'
  const html = '<div id="u20">MERCADO TESTE</div><div class="text">CNPJ: 07.718.633/0020-41</div>' +
    '<table id="tabResult"><tr><td><span class="txtTit">PIMENTAO VERMELHO kg</span><span class="Rqtd">Qtde.:0,302</span><span class="RUN">UN: KG</span><span class="RvlUnit">Vl. Unit.: 19,9</span></td><td><span class="valor">6,01</span></td></tr></table>' +
    '<div id="totalNota"><span class="txtMax">6,01</span></div><div>Emissão: 28/06/2026 14:17:14</div>'
  const result = parseNfceHtml(html, 'https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx?p=' + key + '|3|1')
  assert.equal(result.receipt.totalAmount, 6.01)
  assert.equal(result.items.length, 1)
  assert.deepEqual(result.items[0], { rawName: 'PIMENTAO VERMELHO kg', quantity: 0.302, unitPrice: 19.9, unit: 'kg', behaviorType: 'pontual' })
})

test('encontra o QR Code inclinado em posições diferentes da foto', async () => {
  const key = '43260607718633002041650020008588731426827342'
  const value = 'https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx?p=' + key + '|3|1'
  const matrix = new QRCodeWriter().encode(value, BarcodeFormat.QR_CODE, 260, 260, new Map())
  const pixels = Buffer.alloc(260 * 260 * 3, 255)
  for (let y = 0; y < 260; y += 1) for (let x = 0; x < 260; x += 1) {
    if (matrix.get(x, y)) pixels.fill(0, (y * 260 + x) * 3, (y * 260 + x) * 3 + 3)
  }
  const qr = await sharp(pixels, { raw: { width: 260, height: 260, channels: 3 } }).png().toBuffer()
  const cases = [{ left: 28, top: 24, angle: 14 }, { left: 690, top: 500, angle: -11 }]
  for (const item of cases) {
    const file = path.join(tmpdir(), 'preco-vivo-qr-' + randomUUID() + '.jpg')
    try {
      const rotated = await sharp(qr).rotate(item.angle, { background: '#ffffff' }).toBuffer()
      await sharp({ create: { width: 1100, height: 850, channels: 3, background: '#e5e7eb' } }).composite([{ input: rotated, left: item.left, top: item.top }]).jpeg({ quality: 82 }).toFile(file)
      assert.equal(await decodeQrFromImage(file), value)
    } finally {
      await unlink(file).catch(() => undefined)
    }
  }
})
