import { DynamoDBDocumentClient, PutCommand, QueryCommand, DeleteCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const STOCK_RESERVATIONS_TABLE = process.env.STOCK_RESERVATIONS_TABLE!;

// Stock reservation expires after 10 minutes
const RESERVATION_TTL_MINUTES = 10;

export interface StockReservation {
  productId: string;
  reservationId: string;
  orderId: string;
  quantity: number;
  createdAt: number;
  expiresAt: number;
  status: 'active' | 'confirmed' | 'expired' | 'cancelled';
}

export interface CartItem {
  id: string;
  quantity: number;
}

/**
 * Reserve stock for cart items
 * Returns reservation IDs or throws error if insufficient stock
 */
export async function reserveStock(orderId: string, cartItems: CartItem[]): Promise<string[]> {
  const reservationIds: string[] = [];
  const reservationsToCreate: StockReservation[] = [];
  
  const now = Date.now();
  const expiresAt = Math.floor((now + (RESERVATION_TTL_MINUTES * 60 * 1000)) / 1000); // TTL in seconds

  try {
    // Check current stock and active reservations for each product
    for (const item of cartItems) {
      const productId = item.id;
      const requestedQuantity = item.quantity;

      // Get current active reservations for this product
      const activeReservations = await getActiveReservations(productId);
      const reservedQuantity = activeReservations.reduce((sum, res) => sum + res.quantity, 0);

      // Get current product stock (this will need to be implemented in product service)
      const currentStock = await getCurrentStock(productId);
      const availableStock = currentStock - reservedQuantity;

      if (availableStock < requestedQuantity) {
        throw new Error(`Insufficient stock for product ${productId}. Available: ${availableStock}, Requested: ${requestedQuantity}`);
      }

      // Create reservation record
      const reservationId = `RES-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const reservation: StockReservation = {
        productId,
        reservationId,
        orderId,
        quantity: requestedQuantity,
        createdAt: now,
        expiresAt,
        status: 'active',
      };

      reservationsToCreate.push(reservation);
      reservationIds.push(reservationId);
    }

    // Create all reservations
    for (const reservation of reservationsToCreate) {
      await client.send(new PutCommand({
        TableName: STOCK_RESERVATIONS_TABLE,
        Item: reservation,
      }));
    }

    console.log(`Created ${reservationIds.length} stock reservations for order ${orderId}`, {
      orderId,
      reservationIds,
      expiresIn: `${RESERVATION_TTL_MINUTES} minutes`,
    });

    return reservationIds;
  } catch (error) {
    // If any reservation fails, clean up any that were created
    if (reservationIds.length > 0) {
      console.log('Cleaning up partial reservations due to error');
      await cancelReservations(reservationIds);
    }
    throw error;
  }
}

/**
 * Get active (non-expired) reservations for a product
 */
export async function getActiveReservations(productId: string): Promise<StockReservation[]> {
  const now = Math.floor(Date.now() / 1000);

  const result = await client.send(new QueryCommand({
    TableName: STOCK_RESERVATIONS_TABLE,
    KeyConditionExpression: 'productId = :productId',
    FilterExpression: '#status = :status AND expiresAt > :now',
    ExpressionAttributeNames: {
      '#status': 'status',
    },
    ExpressionAttributeValues: {
      ':productId': productId,
      ':status': 'active',
      ':now': now,
    },
  }));

  return result.Items as StockReservation[] || [];
}

/**
 * Get reservations for an order
 */
export async function getOrderReservations(orderId: string): Promise<StockReservation[]> {
  const result = await client.send(new QueryCommand({
    TableName: STOCK_RESERVATIONS_TABLE,
    IndexName: 'OrderIndex',
    KeyConditionExpression: 'orderId = :orderId',
    ExpressionAttributeValues: {
      ':orderId': orderId,
    },
  }));

  return result.Items as StockReservation[] || [];
}

/**
 * Confirm reservations (convert to permanent stock reduction)
 * This is called when payment is successful
 */
export async function confirmReservations(reservationIds: string[]): Promise<void> {
  console.log(`Confirming ${reservationIds.length} stock reservations`, { reservationIds });

  for (const reservationId of reservationIds) {
    // Find the reservation
    const reservations = await client.send(new ScanCommand({
      TableName: STOCK_RESERVATIONS_TABLE,
      FilterExpression: 'reservationId = :reservationId AND #status = :status',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':reservationId': reservationId,
        ':status': 'active',
      },
    }));

    if (reservations.Items && reservations.Items.length > 0) {
      const reservation = reservations.Items[0] as StockReservation;

      // Update status to confirmed (keeps record for audit)
      await client.send(new PutCommand({
        TableName: STOCK_RESERVATIONS_TABLE,
        Item: {
          ...reservation,
          status: 'confirmed',
          confirmedAt: Date.now(),
        },
      }));

      // Permanently reduce stock in products table
      await permanentlyReduceStock(reservation.productId, reservation.quantity);
    }
  }
}

/**
 * Cancel reservations (release reserved stock)
 * This is called when payment fails or order is cancelled
 */
export async function cancelReservations(reservationIds: string[]): Promise<void> {
  console.log(`Cancelling ${reservationIds.length} stock reservations`, { reservationIds });

  for (const reservationId of reservationIds) {
    // Find and delete the reservation
    const reservations = await client.send(new ScanCommand({
      TableName: STOCK_RESERVATIONS_TABLE,
      FilterExpression: 'reservationId = :reservationId',
      ExpressionAttributeValues: {
        ':reservationId': reservationId,
      },
    }));

    if (reservations.Items && reservations.Items.length > 0) {
      const reservation = reservations.Items[0] as StockReservation;

      // Update status to cancelled (keeps record for audit)
      await client.send(new PutCommand({
        TableName: STOCK_RESERVATIONS_TABLE,
        Item: {
          ...reservation,
          status: 'cancelled',
          cancelledAt: Date.now(),
        },
      }));
    }
  }
}

/**
 * Cancel reservations for an entire order
 */
export async function cancelOrderReservations(orderId: string): Promise<void> {
  const reservations = await getOrderReservations(orderId);
  const activeReservationIds = reservations
    .filter(r => r.status === 'active')
    .map(r => r.reservationId);

  if (activeReservationIds.length > 0) {
    await cancelReservations(activeReservationIds);
  }
}

/**
 * Get current stock from products table
 * This function needs to be implemented based on your product schema
 */
async function getCurrentStock(productId: string): Promise<number> {
  // Import product service to get current stock
  const { getProduct } = await import('./product');
  
  try {
    const product = await getProduct(productId);
    return product?.stock || 0;
  } catch (error) {
    console.error(`Failed to get stock for product ${productId}:`, error);
    return 0;
  }
}

/**
 * Permanently reduce stock in products table
 * This is called when payment is confirmed
 */
async function permanentlyReduceStock(productId: string, quantity: number): Promise<void> {
  // Import product service to update stock
  const { updateProductStock } = await import('./product');
  
  try {
    await updateProductStock(productId, -quantity);
    console.log(`Permanently reduced stock for product ${productId} by ${quantity}`);
  } catch (error) {
    console.error(`Failed to reduce stock for product ${productId}:`, error);
    throw error;
  }
}

/**
 * Cleanup expired reservations (can be called periodically or via scheduled Lambda)
 */
export async function cleanupExpiredReservations(): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  
  // Scan for expired reservations
  const result = await client.send(new ScanCommand({
    TableName: STOCK_RESERVATIONS_TABLE,
    FilterExpression: '#status = :status AND expiresAt < :now',
    ExpressionAttributeNames: {
      '#status': 'status',
    },
    ExpressionAttributeValues: {
      ':status': 'active',
      ':now': now,
    },
  }));

  const expiredReservations = result.Items as StockReservation[] || [];
  
  if (expiredReservations.length > 0) {
    console.log(`Found ${expiredReservations.length} expired reservations to cleanup`);
    
    // Update status to expired
    for (const reservation of expiredReservations) {
      await client.send(new PutCommand({
        TableName: STOCK_RESERVATIONS_TABLE,
        Item: {
          ...reservation,
          status: 'expired',
          expiredAt: Date.now(),
        },
      }));
    }
  }

  return expiredReservations.length;
}