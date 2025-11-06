import type { SwishPaymentRequest, SwishPaymentResponse } from '../schemas/swish';

// Swish API configuration
const SWISH_ENVIRONMENT = process.env.SWISH_ENVIRONMENT || 'test'; // 'test' or 'production'
const SWISH_MERCHANT_NUMBER = process.env.SWISH_MERCHANT_NUMBER || '1234679304'; // Test merchant number
const SWISH_CALLBACK_URL = process.env.SWISH_CALLBACK_URL || 'https://dev.smultron.zwc.se/v1/swish/callback';

// Swish API endpoints
const SWISH_API_BASE_URL = SWISH_ENVIRONMENT === 'production'
  ? 'https://cpc.getswish.net/swish-cpcapi/api/v2'
  : 'https://mss.cpc.getswish.net/swish-cpcapi/api/v2';

interface SwishConfig {
  merchantNumber: string;
  callbackUrl: string;
  certificate?: string;
  privateKey?: string;
  passphrase?: string;
}

/**
 * Initialize Swish payment request
 * Creates a payment request and returns the payment reference
 */
export async function createSwishPayment(
  orderNumber: string,
  amount: number,
  phoneNumber?: string,
  message?: string
): Promise<{ id: string; location: string; status: string }> {
  const config: SwishConfig = {
    merchantNumber: SWISH_MERCHANT_NUMBER,
    callbackUrl: SWISH_CALLBACK_URL,
    // In production, load certificate and private key from AWS Secrets Manager
  };

  const paymentRequest: SwishPaymentRequest = {
    amount,
    currency: 'SEK',
    callbackUrl: config.callbackUrl,
    payeeAlias: config.merchantNumber,
    payerAlias: phoneNumber,
    message: message || `Order ${orderNumber}`,
    payeePaymentReference: orderNumber,
  };

  console.log('Creating Swish payment request:', {
    orderNumber,
    amount,
    phoneNumber,
    environment: SWISH_ENVIRONMENT,
  });

  try {
    // In test mode or if certificates are not configured, return mock response
    if (SWISH_ENVIRONMENT === 'test' || !process.env.SWISH_CERT_PATH) {
      console.log('Using mock Swish payment (test mode)');
      const mockId = `mock-${orderNumber}-${Date.now()}`;
      return {
        id: mockId,
        location: `${SWISH_API_BASE_URL}/paymentrequests/${mockId}`,
        status: 'CREATED',
      };
    }

    // Production implementation would use HTTPS with client certificates
    // const response = await fetch(`${SWISH_API_BASE_URL}/paymentrequests`, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify(paymentRequest),
    //   // Add client certificate for mTLS
    // });

    // For now, return mock response
    const mockId = `mock-${orderNumber}-${Date.now()}`;
    return {
      id: mockId,
      location: `${SWISH_API_BASE_URL}/paymentrequests/${mockId}`,
      status: 'CREATED',
    };
  } catch (error) {
    console.error('Swish payment creation failed:', error);
    throw new Error('Failed to create Swish payment request');
  }
}

/**
 * Get Swish payment status
 */
export async function getSwishPaymentStatus(
  paymentId: string
): Promise<SwishPaymentResponse | null> {
  try {
    console.log('Fetching Swish payment status:', paymentId);

    // In test mode, return mock status
    if (SWISH_ENVIRONMENT === 'test' || paymentId.startsWith('mock-')) {
      return {
        id: paymentId,
        payeePaymentReference: paymentId.split('-')[1] || paymentId,
        payeeAlias: SWISH_MERCHANT_NUMBER,
        amount: 0,
        currency: 'SEK',
        status: 'CREATED',
        dateCreated: new Date().toISOString(),
      };
    }

    // Production implementation would fetch from Swish API
    // const response = await fetch(`${SWISH_API_BASE_URL}/paymentrequests/${paymentId}`, {
    //   method: 'GET',
    //   // Add client certificate for mTLS
    // });

    return null;
  } catch (error) {
    console.error('Failed to get Swish payment status:', error);
    return null;
  }
}

/**
 * Handle Swish callback
 * This is called by Swish when payment status changes
 */
export async function handleSwishCallback(
  paymentId: string,
  status: string
): Promise<void> {
  console.log('Swish callback received:', { paymentId, status });
  
  // TODO: Update order status based on payment status
  // - PAID: Mark order as confirmed
  // - DECLINED/ERROR/CANCELLED: Mark order as cancelled, restore stock
}
