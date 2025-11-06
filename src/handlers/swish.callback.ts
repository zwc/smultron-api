import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { APIResponse } from '../types';
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

    // TODO: Implement order status updates based on payment status
    switch (status) {
      case 'PAID':
        console.log(`✓ Payment SUCCESSFUL for order ${orderNumber}`, {
          amount,
          currency,
          payerAlias,
          datePaid,
        });
        // TODO: Update order status to 'paid' or 'confirmed'
        // TODO: Send confirmation email to customer
        // await updateOrderPaymentStatus(orderNumber, 'paid');
        // await sendOrderConfirmationEmail(orderNumber);
        break;

      case 'DECLINED':
        console.log(`✗ Payment DECLINED for order ${orderNumber}`);
        // TODO: Update order status to 'payment_declined'
        // TODO: Restore product stock
        // TODO: Send payment failed notification
        // await updateOrderPaymentStatus(orderNumber, 'payment_declined');
        // await restoreOrderStock(orderNumber);
        break;

      case 'ERROR':
        console.error(`✗ Payment ERROR for order ${orderNumber}:`, {
          errorCode,
          errorMessage,
        });
        // TODO: Update order status to 'payment_error'
        // TODO: Restore product stock
        // TODO: Alert admin about payment error
        // await updateOrderPaymentStatus(orderNumber, 'payment_error');
        // await restoreOrderStock(orderNumber);
        // await notifyAdminPaymentError(orderNumber, errorCode, errorMessage);
        break;

      case 'CANCELLED':
        console.log(`✗ Payment CANCELLED for order ${orderNumber}`);
        // TODO: Update order status to 'payment_cancelled'
        // TODO: Restore product stock
        // await updateOrderPaymentStatus(orderNumber, 'payment_cancelled');
        // await restoreOrderStock(orderNumber);
        break;

      case 'CREATED':
        console.log(`Payment request CREATED for order ${orderNumber}`);
        // Payment request created, waiting for customer to approve
        // No action needed yet
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
