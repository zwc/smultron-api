export interface PaymentRequestInput {
  amount: string;
  currency?: string;
  payerAlias?: string;
  payeePaymentReference?: string;
  message?: string;
}

export interface PaymentRequestPayload {
  callbackUrl: string;
  payeeAlias: string;
  amount: string;
  currency: string;
  payerAlias?: string;
  payeePaymentReference?: string;
  message?: string;
}

export interface PaymentRequestResult {
  instructionId: string;
  status: number;
  location?: string;
  paymentRequestToken?: string;
}

export interface PaymentStatus {
  id: string;
  payeePaymentReference: string;
  paymentReference: string;
  callbackUrl: string;
  payerAlias: string;
  payeeAlias: string;
  amount: number;
  currency: string;
  message: string;
  status: "CREATED" | "PAID" | "DECLINED" | "ERROR" | "CANCELLED";
  dateCreated: string;
  datePaid: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface SwishCallbackPayload {
  id: string;
  payeePaymentReference: string;
  paymentReference: string;
  callbackUrl: string;
  payerAlias: string;
  payeeAlias: string;
  amount: number;
  currency: string;
  message: string;
  status: "PAID" | "DECLINED" | "ERROR" | "CANCELLED";
  dateCreated: string;
  datePaid: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface SwishError {
  errorCode: string;
  errorMessage: string;
  additionalInformation: string | null;
}
