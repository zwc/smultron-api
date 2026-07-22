import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { OrderConfirmationData } from './email-types'

const moduleDir = dirname(fileURLToPath(import.meta.url))

function resolveEmailDir(): string {
  // Lambda dist layout: dist/index.js + dist/email/*.html
  // Local/src layout: src/services → ../../email
  const candidates = [
    join(moduleDir, 'email'),
    join(moduleDir, '../email'),
    join(moduleDir, '../../email'),
  ]
  for (const dir of candidates) {
    try {
      readFileSync(join(dir, 'email-postnord.html'), 'utf8')
      return dir
    } catch {
      // try next
    }
  }
  return join(moduleDir, '../../email')
}

const EMAIL_DIR = resolveEmailDir()

/** Format SEK as Swedish currency string, e.g. "1 198 kr" */
export function formatSek(amount: number): string {
  const rounded =
    Math.abs(amount - Math.round(amount)) < 0.001
      ? Math.round(amount)
      : Math.round(amount * 100) / 100
  const useFrac = Math.abs(rounded - Math.round(rounded)) >= 0.001
  const [intPart, fracPart] = rounded.toFixed(useFrac ? 2 : 0).split('.')
  const withSpaces = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  if (fracPart && Number(fracPart) !== 0) {
    return `${withSpaces},${fracPart} kr`
  }
  return `${withSpaces} kr`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function isPostnord(deliveryMethod: string): boolean {
  return deliveryMethod.toLowerCase().includes('postnord')
}

function loadTemplate(deliveryMethod: string): string {
  const file = isPostnord(deliveryMethod)
    ? 'email-postnord.html'
    : 'email-pickup.html'
  return readFileSync(join(EMAIL_DIR, file), 'utf8')
}

function buildProductsHtml(
  items: OrderConfirmationData['cartItems'],
): string {
  return items
    .map(
      (item) => `
				<table style="width: 100%;margin: 0 0 12px 0;padding: 0;border-spacing: 0;border: none;outline: none;font-size: 14px;line-height: 1.5;">
					<tr style="margin: 0;padding: 0;border-spacing: 0;">
						<td style="margin: 0;padding: 8px 0 8px 0;border-spacing: 0;vertical-align: top;border-bottom: 1px dotted rgba(0,0,0,0.5);">${escapeHtml(item.name)}</td>
						<td style="font-family: 'apercu-mono', monospace;font-size: 13px;color: grey;margin: 0;padding: 8px 0 8px 0;border-spacing: 0;vertical-align: top;border-bottom: 1px dotted rgba(0,0,0,0.5);text-align: right;">${formatSek(item.price)}</td>
					</tr>
					<tr style="margin: 0;padding: 0;border-spacing: 0;">
						<td style="border: none;margin: 0;padding: 8px 0 8px 0;border-spacing: 0;vertical-align: top;border-bottom: none;">${item.quantity} st</td>
						<td style="border: none;font-family: 'apercu-mono', monospace;font-size: 13px;margin: 0;padding: 8px 0 8px 0;border-spacing: 0;vertical-align: top;border-bottom: none;text-align: right;">${formatSek(item.quantity * item.price)}</td>
					</tr>
				</table>
`,
    )
    .join('\n')
}

function buildAddressBlock(data: OrderConfirmationData): string {
  const lines: string[] = []
  const company = data.deliveryAddress?.company?.trim()
  if (company) lines.push(escapeHtml(company))
  lines.push(escapeHtml(data.customerName))
  if (data.deliveryAddress) {
    lines.push(escapeHtml(data.deliveryAddress.address))
    lines.push(
      escapeHtml(
        `${data.deliveryAddress.zip} ${data.deliveryAddress.city}`.trim(),
      ),
    )
  }
  return lines.join('<br>')
}

function buildNameBlock(data: OrderConfirmationData): string {
  const lines: string[] = []
  const company = data.deliveryAddress?.company?.trim()
  if (company) lines.push(escapeHtml(company))
  lines.push(escapeHtml(data.customerName))
  return lines.join('<br>')
}

export function renderOrderEmailHtml(data: OrderConfirmationData): string {
  const template = loadTemplate(data.deliveryMethod)
  const phone = data.customerPhone || ''
  const phoneTel = phone.replace(/[^\d+]/g, '')

  return template
    .replaceAll('{{ORDER_NUMBER}}', escapeHtml(data.orderId))
    .replaceAll('{{DELIVERY_COST}}', formatSek(data.deliveryCost))
    .replaceAll('{{SWISH_AMOUNT}}', formatSek(data.orderTotal))
    .replaceAll('{{ADDRESS_BLOCK}}', buildAddressBlock(data))
    .replaceAll('{{NAME_BLOCK}}', buildNameBlock(data))
    .replaceAll('{{EMAIL}}', escapeHtml(data.customerEmail))
    .replaceAll('{{PHONE}}', escapeHtml(phone))
    .replaceAll('{{PHONE_TEL}}', escapeHtml(phoneTel))
    .replaceAll('{{PRODUCTS_HTML}}', buildProductsHtml(data.cartItems))
}

export function generateOrderEmailText(
  data: OrderConfirmationData,
  adminEmail: string,
): string {
  const itemsText = data.cartItems
    .map(
      (item) =>
        `${item.name} x${item.quantity} — ${formatSek(item.quantity * item.price)}`,
    )
    .join('\n')

  const deliveryLabel = isPostnord(data.deliveryMethod)
    ? 'PostNord'
    : 'Upphämtning'

  const addressLines = data.deliveryAddress
    ? [
        data.deliveryAddress.company,
        data.customerName,
        data.deliveryAddress.address,
        `${data.deliveryAddress.zip} ${data.deliveryAddress.city}`,
      ]
        .filter(Boolean)
        .join('\n')
    : data.customerName

  return `
Orderbekräftelse

Tack för din beställning, ${data.customerName}!

Beställningsnummer: ${data.orderId}
Leverans – ${deliveryLabel}: ${formatSek(data.deliveryCost)}
Betalat – Swish: ${formatSek(data.orderTotal)}
${data.deliveryAddress ? `Adress:\n${addressLines}` : `Namn: ${addressLines}`}
E-post: ${data.customerEmail}
${data.customerPhone ? `Telefon: ${data.customerPhone}` : ''}

Produkter:
${itemsText}

Har du frågor? Kontakta oss på ${adminEmail}.
  `.trim()
}
