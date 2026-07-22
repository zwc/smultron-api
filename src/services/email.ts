import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'
import type { OrderConfirmationData } from './email-types'
import {
  generateOrderEmailText,
  renderOrderEmailHtml,
} from './email-template'

export type { OrderConfirmationData } from './email-types'
export { formatSek, renderOrderEmailHtml } from './email-template'

const sesClient = new SESClient({
  region: process.env.AWS_REGION || 'eu-north-1',
})

// Email configuration — override via environment variables in each deployment stage.
// FROM_EMAIL must be a verified SES identity.
const FROM_EMAIL = process.env.FROM_EMAIL || 'minibutik@smultronet.nu'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'minibutik@smultronet.nu'

/**
 * Send order confirmation email to customer
 */
export async function sendCustomerOrderConfirmation(
  data: OrderConfirmationData,
): Promise<void> {
  const subject = `Orderbekräftelse – ${data.orderId}`
  const htmlBody = renderOrderEmailHtml(data)
  const textBody = generateOrderEmailText(data, ADMIN_EMAIL)

  try {
    await sesClient.send(
      new SendEmailCommand({
        Source: FROM_EMAIL,
        Destination: {
          ToAddresses: [data.customerEmail],
        },
        Message: {
          Subject: {
            Data: subject,
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: htmlBody,
              Charset: 'UTF-8',
            },
            Text: {
              Data: textBody,
              Charset: 'UTF-8',
            },
          },
        },
      }),
    )

    console.log(
      `Order confirmation email sent to customer: ${data.customerEmail}`,
      {
        orderId: data.orderId,
        customerEmail: data.customerEmail,
      },
    )
  } catch (error) {
    console.error('Failed to send customer confirmation email:', error)
    throw error
  }
}

/**
 * Send order notification email to Smultronet admin
 */
export async function sendAdminOrderNotification(
  data: OrderConfirmationData,
): Promise<void> {
  const subject = `Ny order – ${data.orderId}`
  const htmlBody = renderOrderEmailHtml(data)
  const textBody = generateOrderEmailText(data, ADMIN_EMAIL)

  try {
    await sesClient.send(
      new SendEmailCommand({
        Source: FROM_EMAIL,
        Destination: {
          ToAddresses: [ADMIN_EMAIL],
        },
        Message: {
          Subject: {
            Data: subject,
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: htmlBody,
              Charset: 'UTF-8',
            },
            Text: {
              Data: textBody,
              Charset: 'UTF-8',
            },
          },
        },
      }),
    )

    console.log(`Order notification email sent to admin: ${ADMIN_EMAIL}`, {
      orderId: data.orderId,
      customerEmail: data.customerEmail,
    })
  } catch (error) {
    console.error('Failed to send admin notification email:', error)
    throw error
  }
}

/**
 * Send both customer confirmation and admin notification
 */
export async function sendOrderConfirmationEmails(
  data: OrderConfirmationData,
): Promise<void> {
  await Promise.all([
    sendCustomerOrderConfirmation(data),
    sendAdminOrderNotification(data),
  ])
}
