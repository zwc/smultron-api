import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { APIResponse } from '../types';
import { getOrderByNumber, updateOrder } from '../services/product';
import { confirmReservations, cancelOrderReservations } from '../services/stock-reservation';
import { sendOrderConfirmationEmails, type OrderConfirmationData } from '../services/email';
import { successResponse, errorResponse } from '../utils/response';

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

    // Extract order number from payment reference
    const orderNumber = payeePaymentReference;

    // Process payment status and update order accordingly
    switch (status) {
      case 'PAID':
        console.log(`✓ Payment SUCCESSFUL for order ${orderNumber}`, {
          amount,
          currency,
          payerAlias,
          datePaid,
        });
        
        try {
          // Get the order
          const order = await getOrderByNumber(orderNumber);
          if (!order) {
            console.error(`Order ${orderNumber} not found`);
            break;
          }

          // Confirm stock reservations (converts reservations to permanent stock reduction)
          // Note: We need to get reservation IDs for this order, for now we'll skip this step
          // and handle stock reduction through reservations system
          // await confirmReservations(reservationIds);
          
          // Update order status to active (confirmed and paid)
          await updateOrder(order.id, { status: 'active' });
          
          // Send confirmation emails
          const emailData = createEmailData(order, 'swish', id, amount, currency);
          await sendOrderConfirmationEmails(emailData);
          
          console.log(`Order ${orderNumber} confirmed and emails sent`);
        } catch (error) {
          console.error(`Failed to process successful payment for order ${orderNumber}:`, error);
        }
        break;

      case 'DECLINED':
        console.log(`✗ Payment DECLINED for order ${orderNumber}`);
        
        try {
          // Get the order
          const order = await getOrderByNumber(orderNumber);
          if (!order) {
            console.error(`Order ${orderNumber} not found`);
            break;
          }

          // Cancel stock reservations (releases reserved stock)
          await cancelOrderReservations(order.id);
          
          // Update order status to invalid (payment declined)
          await updateOrder(order.id, { status: 'invalid' });
          
          console.log(`Order ${orderNumber} marked as invalid, stock reservations cancelled`);
        } catch (error) {
          console.error(`Failed to process declined payment for order ${orderNumber}:`, error);
        }
        break;

      case 'ERROR':
        console.error(`✗ Payment ERROR for order ${orderNumber}:`, {
          errorCode,
          errorMessage,
        });
        
        try {
          // Get the order
          const order = await getOrderByNumber(orderNumber);
          if (!order) {
            console.error(`Order ${orderNumber} not found`);
            break;
          }

          // Cancel stock reservations (releases reserved stock)
          await cancelOrderReservations(order.id);
          
          // Update order status to invalid (payment error)
          await updateOrder(order.id, { status: 'invalid' });
          
          console.log(`Order ${orderNumber} marked as invalid due to payment error, stock reservations cancelled`);
        } catch (error) {
          console.error(`Failed to process payment error for order ${orderNumber}:`, error);
        }
        break;

      case 'CANCELLED':
        console.log(`✗ Payment CANCELLED for order ${orderNumber}`);
        
        try {
          // Get the order
          const order = await getOrderByNumber(orderNumber);
          if (!order) {
            console.error(`Order ${orderNumber} not found`);
            break;
          }

          // Cancel stock reservations (releases reserved stock)
          await cancelOrderReservations(order.id);
          
          // Update order status to invalid (payment cancelled)
          await updateOrder(order.id, { status: 'invalid' });
          
          console.log(`Order ${orderNumber} marked as invalid, stock reservations cancelled`);
        } catch (error) {
          console.error(`Failed to process cancelled payment for order ${orderNumber}:`, error);
        }
        break;

      case 'CREATED':
        console.log(`Payment request CREATED for order ${orderNumber}`);
        // Payment request created, waiting for customer to approve
        // No action needed yet - stock is already reserved
        break;

      default:
        console.warn(`Unknown payment status: ${status} for order ${orderNumber}`);
    }

    // Always return 200 OK to acknowledge the callback
    // Swish will retry if we don't return 200
    return successResponse({ 
      received: true,
      orderNumber,
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
