import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const sesClient = new SESClient({ region: process.env.AWS_REGION || 'eu-north-1' });

// Email configuration
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@smultron.zwc.se';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'smultronet@zwc.se';

export interface OrderConfirmationData {
  orderId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  orderTotal: number;
  currency: string;
  cartItems: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  deliveryMethod: string;
  deliveryCost: number;
  paymentMethod: string;
  paymentReference?: string;
  deliveryAddress?: {
    company?: string;
    address: string;
    zip: string;
    city: string;
  };
}

/**
 * Send order confirmation email to customer
 */
export async function sendCustomerOrderConfirmation(data: OrderConfirmationData): Promise<void> {
  const subject = `Order Confirmation - ${data.orderId}`;
  
  const htmlBody = generateCustomerEmailHTML(data);
  const textBody = generateCustomerEmailText(data);

  try {
    await sesClient.send(new SendEmailCommand({
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
    }));

    console.log(`Order confirmation email sent to customer: ${data.customerEmail}`, {
      orderId: data.orderId,
      customerEmail: data.customerEmail,
    });
  } catch (error) {
    console.error('Failed to send customer confirmation email:', error);
    throw error;
  }
}

/**
 * Send order notification email to Smultronet admin
 */
export async function sendAdminOrderNotification(data: OrderConfirmationData): Promise<void> {
  const subject = `New Order Received - ${data.orderId}`;
  
  const htmlBody = generateAdminEmailHTML(data);
  const textBody = generateAdminEmailText(data);

  try {
    await sesClient.send(new SendEmailCommand({
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
    }));

    console.log(`Order notification email sent to admin: ${ADMIN_EMAIL}`, {
      orderId: data.orderId,
      customerEmail: data.customerEmail,
    });
  } catch (error) {
    console.error('Failed to send admin notification email:', error);
    throw error;
  }
}

/**
 * Send both customer confirmation and admin notification
 */
export async function sendOrderConfirmationEmails(data: OrderConfirmationData): Promise<void> {
  await Promise.all([
    sendCustomerOrderConfirmation(data),
    sendAdminOrderNotification(data),
  ]);
}

function generateCustomerEmailHTML(data: OrderConfirmationData): string {
  const itemsHTML = data.cartItems.map(item => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${item.price.toFixed(2)} ${data.currency}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${(item.quantity * item.price).toFixed(2)} ${data.currency}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Order Confirmation</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h1 style="color: #2c5530; margin: 0;">Order Confirmation</h1>
            <p style="margin: 10px 0 0 0; color: #666;">Thank you for your order, ${data.customerName}!</p>
        </div>

        <div style="background-color: white; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #2c5530; margin-top: 0;">Order Details</h2>
            <p><strong>Order ID:</strong> ${data.orderId}</p>
            <p><strong>Payment Method:</strong> ${data.paymentMethod}</p>
            ${data.paymentReference ? `<p><strong>Payment Reference:</strong> ${data.paymentReference}</p>` : ''}
            <p><strong>Delivery Method:</strong> ${data.deliveryMethod}</p>
            ${data.deliveryAddress ? `
            <p><strong>Delivery Address:</strong><br>
            ${data.deliveryAddress.company ? data.deliveryAddress.company + '<br>' : ''}
            ${data.deliveryAddress.address}<br>
            ${data.deliveryAddress.zip} ${data.deliveryAddress.city}</p>
            ` : ''}
        </div>

        <div style="background-color: white; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #2c5530; margin-top: 0;">Order Items</h2>
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background-color: #f8f9fa;">
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6;">Item</th>
                        <th style="padding: 12px; text-align: center; border-bottom: 2px solid #dee2e6;">Qty</th>
                        <th style="padding: 12px; text-align: right; border-bottom: 2px solid #dee2e6;">Price</th>
                        <th style="padding: 12px; text-align: right; border-bottom: 2px solid #dee2e6;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHTML}
                </tbody>
                <tfoot>
                    ${data.deliveryCost > 0 ? `
                    <tr>
                        <td colspan="3" style="padding: 8px; text-align: right; font-weight: bold;">Delivery:</td>
                        <td style="padding: 8px; text-align: right; font-weight: bold;">${data.deliveryCost.toFixed(2)} ${data.currency}</td>
                    </tr>
                    ` : ''}
                    <tr style="background-color: #f8f9fa;">
                        <td colspan="3" style="padding: 12px; text-align: right; font-weight: bold; font-size: 1.1em;">Total:</td>
                        <td style="padding: 12px; text-align: right; font-weight: bold; font-size: 1.1em;">${data.orderTotal.toFixed(2)} ${data.currency}</td>
                    </tr>
                </tfoot>
            </table>
        </div>

        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; color: #666; font-size: 14px;">
            <p>We'll process your order and contact you if we need any additional information.</p>
            <p>If you have any questions about your order, please contact us at ${ADMIN_EMAIL}.</p>
            <p style="margin-bottom: 0;"><strong>Thank you for choosing Smultron!</strong></p>
        </div>
    </body>
    </html>
  `;
}

function generateCustomerEmailText(data: OrderConfirmationData): string {
  const itemsText = data.cartItems.map(item => 
    `${item.name} x${item.quantity} - ${(item.quantity * item.price).toFixed(2)} ${data.currency}`
  ).join('\n');

  return `
Order Confirmation

Thank you for your order, ${data.customerName}!

Order Details:
- Order ID: ${data.orderId}
- Payment Method: ${data.paymentMethod}
${data.paymentReference ? `- Payment Reference: ${data.paymentReference}` : ''}
- Delivery Method: ${data.deliveryMethod}
${data.deliveryAddress ? `
- Delivery Address:
  ${data.deliveryAddress.company ? data.deliveryAddress.company + '\n  ' : ''}${data.deliveryAddress.address}
  ${data.deliveryAddress.zip} ${data.deliveryAddress.city}` : ''}

Order Items:
${itemsText}
${data.deliveryCost > 0 ? `\nDelivery: ${data.deliveryCost.toFixed(2)} ${data.currency}` : ''}

Total: ${data.orderTotal.toFixed(2)} ${data.currency}

We'll process your order and contact you if we need any additional information.
If you have any questions about your order, please contact us at ${ADMIN_EMAIL}.

Thank you for choosing Smultron!
  `.trim();
}

function generateAdminEmailHTML(data: OrderConfirmationData): string {
  const itemsHTML = data.cartItems.map(item => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${item.price.toFixed(2)} ${data.currency}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${(item.quantity * item.price).toFixed(2)} ${data.currency}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>New Order Received</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #ffeaa7;">
            <h1 style="color: #856404; margin: 0;">New Order Received</h1>
            <p style="margin: 10px 0 0 0; color: #856404;">A new order has been placed on Smultron.</p>
        </div>

        <div style="background-color: white; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #2c5530; margin-top: 0;">Order Information</h2>
            <p><strong>Order ID:</strong> ${data.orderId}</p>
            <p><strong>Customer:</strong> ${data.customerName}</p>
            <p><strong>Email:</strong> ${data.customerEmail}</p>
            ${data.customerPhone ? `<p><strong>Phone:</strong> ${data.customerPhone}</p>` : ''}
            <p><strong>Payment Method:</strong> ${data.paymentMethod}</p>
            ${data.paymentReference ? `<p><strong>Payment Reference:</strong> ${data.paymentReference}</p>` : ''}
            <p><strong>Delivery Method:</strong> ${data.deliveryMethod}</p>
            ${data.deliveryAddress ? `
            <p><strong>Delivery Address:</strong><br>
            ${data.deliveryAddress.company ? data.deliveryAddress.company + '<br>' : ''}
            ${data.deliveryAddress.address}<br>
            ${data.deliveryAddress.zip} ${data.deliveryAddress.city}</p>
            ` : ''}
        </div>

        <div style="background-color: white; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #2c5530; margin-top: 0;">Order Items</h2>
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background-color: #f8f9fa;">
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6;">Item</th>
                        <th style="padding: 12px; text-align: center; border-bottom: 2px solid #dee2e6;">Qty</th>
                        <th style="padding: 12px; text-align: right; border-bottom: 2px solid #dee2e6;">Price</th>
                        <th style="padding: 12px; text-align: right; border-bottom: 2px solid #dee2e6;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHTML}
                </tbody>
                <tfoot>
                    ${data.deliveryCost > 0 ? `
                    <tr>
                        <td colspan="3" style="padding: 8px; text-align: right; font-weight: bold;">Delivery:</td>
                        <td style="padding: 8px; text-align: right; font-weight: bold;">${data.deliveryCost.toFixed(2)} ${data.currency}</td>
                    </tr>
                    ` : ''}
                    <tr style="background-color: #f8f9fa;">
                        <td colspan="3" style="padding: 12px; text-align: right; font-weight: bold; font-size: 1.1em;">Total:</td>
                        <td style="padding: 12px; text-align: right; font-weight: bold; font-size: 1.1em;">${data.orderTotal.toFixed(2)} ${data.currency}</td>
                    </tr>
                </tfoot>
            </table>
        </div>

        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; color: #666; font-size: 14px;">
            <p>Please process this order in the admin panel and confirm delivery details with the customer.</p>
            <p style="margin-bottom: 0;">Login to admin: <a href="https://smultron.zwc.se/admin">https://smultron.zwc.se/admin</a></p>
        </div>
    </body>
    </html>
  `;
}

function generateAdminEmailText(data: OrderConfirmationData): string {
  const itemsText = data.cartItems.map(item => 
    `${item.name} x${item.quantity} - ${(item.quantity * item.price).toFixed(2)} ${data.currency}`
  ).join('\n');

  return `
New Order Received

A new order has been placed on Smultron.

Order Information:
- Order ID: ${data.orderId}
- Customer: ${data.customerName}
- Email: ${data.customerEmail}
${data.customerPhone ? `- Phone: ${data.customerPhone}` : ''}
- Payment Method: ${data.paymentMethod}
${data.paymentReference ? `- Payment Reference: ${data.paymentReference}` : ''}
- Delivery Method: ${data.deliveryMethod}
${data.deliveryAddress ? `
- Delivery Address:
  ${data.deliveryAddress.company ? data.deliveryAddress.company + '\n  ' : ''}${data.deliveryAddress.address}
  ${data.deliveryAddress.zip} ${data.deliveryAddress.city}` : ''}

Order Items:
${itemsText}
${data.deliveryCost > 0 ? `\nDelivery: ${data.deliveryCost.toFixed(2)} ${data.currency}` : ''}

Total: ${data.orderTotal.toFixed(2)} ${data.currency}

Please process this order in the admin panel and confirm delivery details with the customer.
Login to admin: https://smultron.zwc.se/admin
  `.trim();
}