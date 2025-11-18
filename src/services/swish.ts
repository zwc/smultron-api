import type { SwishPaymentRequest, SwishPaymentResponse } from '../schemas/swish';

// Swish API configuration
// Environments: 'mock', 'mss', 'sandbox', 'production'
const SWISH_ENVIRONMENT = process.env.SWISH_ENVIRONMENT || 'mock';
const SWISH_MERCHANT_NUMBER = process.env.SWISH_MERCHANT_NUMBER || '1234679304'; // MSS test merchant number
const SWISH_CALLBACK_URL = process.env.SWISH_CALLBACK_URL || 'https://dev.smultron.zwc.se/v1/swish/callback';

// Swish API endpoints based on environment
const SWISH_API_BASE_URL = 
  SWISH_ENVIRONMENT === 'production' 
    ? 'https://cpc.getswish.net/swish-cpcapi/api/v2'
  : SWISH_ENVIRONMENT === 'sandbox'
    ? 'https://staging.getswish.pub.tds.tieto.com/swish-cpcapi/api/v2'
  : SWISH_ENVIRONMENT === 'mss'
    ? 'https://mss.cpc.getswish.net/swish-cpcapi/api/v2'
  : ''; // mock mode, no actual API calls

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
 * 
 * Note: Swish uses PUT with a UUID in the URL, not POST
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

  // Generate UUID for the payment request (instruction ID)
  const instructionId = crypto.randomUUID();

  const paymentRequest: any = {
    payeePaymentReference: orderNumber,
    callbackUrl: config.callbackUrl,
    payeeAlias: config.merchantNumber,
    currency: 'SEK',
    amount: amount.toString(), // Swish expects string, not number
    message: message || `Order ${orderNumber}`,
  };

  // Only include payerAlias if phone number is provided (M-commerce)
  // For e-commerce, omit payerAlias and customer enters number in Swish app
  if (phoneNumber) {
    // Clean phone number: remove non-digits and ensure it starts with country code
    let cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '46' + cleanPhone.substring(1); // Convert Swedish 0-prefix to +46
    }
    if (!cleanPhone.startsWith('46')) {
      cleanPhone = '46' + cleanPhone;
    }
    paymentRequest.payerAlias = cleanPhone;
  }

  console.log('Creating Swish payment request:', {
    instructionId,
    orderNumber,
    amount: paymentRequest.amount,
    phoneNumber: paymentRequest.payerAlias,
    environment: SWISH_ENVIRONMENT,
    baseUrl: SWISH_API_BASE_URL,
  });

  try {
    // In mock mode, return mock response without making API calls
    if (SWISH_ENVIRONMENT === 'mock') {
      console.log('Using mock Swish payment (mock mode - no API call)');
      return {
        id: instructionId,
        location: `https://mss.cpc.getswish.net/swish-cpcapi/api/v2/paymentrequests/${instructionId}`,
        status: 'CREATED',
      };
    }

    // For MSS, Sandbox, or Production - make actual API call
    // Requires certificates to be configured
    if (!process.env.SWISH_CERT_PATH || !process.env.SWISH_KEY_PATH) {
      throw new Error(
        `Swish certificates not configured for ${SWISH_ENVIRONMENT} environment. ` +
        'Set SWISH_CERT_PATH, SWISH_KEY_PATH, and optionally SWISH_CA_CERT_PATH environment variables.'
      );
    }

    // Production implementation with actual HTTPS client using fetch
    const fs = require('fs');
    const https = require('https');

    // For MSS and Sandbox, use .p12 certificate with passphrase 'swish'
    // For Production, use your merchant certificates from Swish Portal
    const certConfig: any = {
      cert: fs.readFileSync(process.env.SWISH_CERT_PATH!, { encoding: 'utf8' }),
      key: fs.readFileSync(process.env.SWISH_KEY_PATH!, { encoding: 'utf8' }),
    };

    // Add CA cert if provided (required for production, optional for MSS/Sandbox)
    if (process.env.SWISH_CA_CERT_PATH) {
      certConfig.ca = fs.readFileSync(process.env.SWISH_CA_CERT_PATH!, { encoding: 'utf8' });
    }

    // Add passphrase if provided (MSS test certs use 'swish')
    if (process.env.SWISH_PASSPHRASE) {
      certConfig.passphrase = process.env.SWISH_PASSPHRASE;
    }

    const agent = new https.Agent(certConfig);

    const response = await fetch(
      `${SWISH_API_BASE_URL}/paymentrequests/${instructionId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentRequest),
        // @ts-ignore - Node.js fetch supports agent option
        agent,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Swish API error: ${response.status} ${errorText}`);
    }

    const location = response.headers.get('location') || `${SWISH_API_BASE_URL}/paymentrequests/${instructionId}`;

    console.log('Swish payment created:', {
      status: response.status,
      location,
      instructionId,
    });

    return {
      id: instructionId,
      location,
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
