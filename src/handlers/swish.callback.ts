import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { APIResponse } from '../types';
import { getOrder, updateOrder, assignOrderNumber } from '../services/product';
import { cancelOrderReservations, confirmOrderReservations } from '../services/stock-reservation';
import { sendOrderConfirmationEmails, type OrderConfirmationData } from '../services/email';
import { successResponse } from '../utils/response';

// Reconstruct a UUID from the 32-char hex string sent as payeePaymentReference.
// At checkout we strip hyphens from the UUID (36→32 chars) to fit Swish's 35-char limit.
const swishRefToOrderId = (ref: string): string =>
  `${ref.slice(0, 8)}-${ref.slice(8, 12)}-${ref.slice(12, 16)}-${ref.slice(16, 20)}-${ref.slice(20)}`

export const method = 'POST';
export const route = '/swish/callback';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIResponse> => {
  try {
    console.log('Swish callback received');
    console.log('Headers:', JSON.stringify(event.headers));
    console.log('Body:', event.body);

    if (!event.body) {
      console.warn('Swish callback received without body');
      // Return 200 anyway to acknowledge receipt
      return successResponse({ received: true });
    }

    const callback = JSON.parse(event.body);
    
    const { 
      id, 
      payeePaymentReference, 
      status, 
      errorCode, 
      errorMessage,
      amount,
      currency,
      payerAlias,
      dateCreated,
      datePaid
    } = callback;

    console.log('Swish callback data:', {
      id,
      payeePaymentReference,
      status,
      errorCode,
      errorMessage,
      amount,
      currency,
    });

    // payeePaymentReference is the UUID-without-hyphens sent at checkout time.
    // Reconstruct the full UUID to look up the order by its partition key.
    const orderId = swishRefToOrderId(payeePaymentReference);

    // Process payment status and update order accordingly
    switch (status) {
      case 'PAID':
        console.log(`✓ Payment SUCCESSFUL for order ${orderId}`, {
          amount,
          currency,
          payerAlias,
          datePaid,
        });
        
        try {
          const order = await getOrder(orderId);
          if (!order) {
            console.error(`Order ${orderId} not found`);
            break;
          }

          // Permanently reduce stock and mark reservations as confirmed
          await confirmOrderReservations(order.id);

          // Assign the order number now that payment is confirmed. This is the
          // first and only time a number is generated, keeping the sequence gap-free.
          const orderNumber = await assignOrderNumber(order.id);

          const paidAmount = amount != null ? parseFloat(amount) : undefined

          // Mark order as paid/confirmed and persist the Swish amount
          await updateOrder(order.id, {
            status: 'active',
            ...(paidAmount != null && !Number.isNaN(paidAmount)
              ? { amount: paidAmount }
              : {}),
          });

          // Send confirmation emails with the now-assigned order number
          const emailData = createEmailData({ ...order, number: orderNumber }, 'swish', id, amount, currency);
          await sendOrderConfirmationEmails(emailData);
          
          console.log(`Order ${orderId} confirmed with number ${orderNumber} and emails sent`);
        } catch (error) {
          console.error(`Failed to process successful payment for order ${orderId}:`, error);
        }
        break;

      case 'DECLINED':
        console.log(`✗ Payment DECLINED for order ${orderId}`);
        
        try {
          const order = await getOrder(orderId);
          if (!order) {
            console.error(`Order ${orderId} not found`);
            break;
          }

          await cancelOrderReservations(order.id);
          await updateOrder(order.id, { status: 'invalid' });
          
          console.log(`Order ${orderId} marked as invalid, stock reservations cancelled`);
        } catch (error) {
          console.error(`Failed to process declined payment for order ${orderId}:`, error);
        }
        break;

      case 'ERROR':
        console.error(`✗ Payment ERROR for order ${orderId}:`, {
          errorCode,
          errorMessage,
        });
        
        try {
          const order = await getOrder(orderId);
          if (!order) {
            console.error(`Order ${orderId} not found`);
            break;
          }

          await cancelOrderReservations(order.id);
          await updateOrder(order.id, { status: 'invalid' });
          
          console.log(`Order ${orderId} marked as invalid due to payment error, stock reservations cancelled`);
        } catch (error) {
          console.error(`Failed to process payment error for order ${orderId}:`, error);
        }
        break;

      case 'CANCELLED':
        console.log(`✗ Payment CANCELLED for order ${orderId}`);
        
        try {
          const order = await getOrder(orderId);
          if (!order) {
            console.error(`Order ${orderId} not found`);
            break;
          }

          await cancelOrderReservations(order.id);
          await updateOrder(order.id, { status: 'invalid' });
          
          console.log(`Order ${orderId} marked as invalid, stock reservations cancelled`);
        } catch (error) {
          console.error(`Failed to process cancelled payment for order ${orderId}:`, error);
        }
        break;

      case 'CREATED':
        console.log(`Payment request CREATED for order ${orderId}`);
        // Payment request created, waiting for customer to approve
        // No action needed yet - stock is already reserved
        break;

      default:
        console.warn(`Unknown payment status: ${status} for order ${orderId}`);
    }

    // Always return 200 OK to acknowledge the callback
    // Swish will retry if we don't return 200
    return successResponse({ 
      received: true,
      orderId,
      status,
    });

  } catch (error) {
    console.error('Swish callback processing error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    // Still return 200 to prevent Swish from retrying
    // Log the error for manual investigation
    return successResponse({ 
      received: true, 
      error: 'Processing error - logged for review' 
    });
  }
};

/**
 * Create email data from order information
 */
function createEmailData(
  order: any, 
  paymentMethod: string, 
  paymentReference: string,
  amount?: string,
  currency?: string
): OrderConfirmationData {
  // Calculate order total from cart items
  const cartTotal = order.cart.reduce((sum: number, item: any) => 
    sum + (item.price || 0) * item.number, 0
  );
  const orderTotal = cartTotal + (order.delivery_cost || 0);

  return {
    orderId: order.number,
    customerName: order.information.name,
    customerEmail: order.information.email,
    customerPhone: order.information.phone,
    orderTotal: amount ? parseFloat(amount) : orderTotal,
    currency: currency || 'SEK',
    cartItems: order.cart.map((item: any) => ({
      name: item.title || 'Unknown Product',
      quantity: item.number,
      price: item.price || 0,
    })),
    deliveryMethod: order.delivery,
    deliveryCost: order.delivery_cost || 0,
    paymentMethod,
    paymentReference,
    deliveryAddress: order.information.address ? {
      company: order.information.company,
      address: order.information.address,
      zip: order.information.zip,
      city: order.information.city,
    } : undefined,
  };
}
