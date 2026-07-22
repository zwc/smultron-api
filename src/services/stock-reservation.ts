import { DynamoDBDocumentClient, PutCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { updateProductStock } from './product';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const STOCK_RESERVATIONS_TABLE = process.env.STOCK_RESERVATIONS_TABLE!;

// Stock reservation expires after 5 minutes
const RESERVATION_TTL_MINUTES = 5;

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
 * Reserve stock for cart items by atomically decrementing product stock.
 * Returns reservation IDs or throws error if insufficient stock.
 */
export async function reserveStock(orderId: string, cartItems: CartItem[]): Promise<string[]> {
  const reservationIds: string[] = [];
  const decremented: Array<{ productId: string; quantity: number }> = [];
  const reservationsToCreate: StockReservation[] = [];

  const now = Date.now();
  const expiresAt = Math.floor((now + (RESERVATION_TTL_MINUTES * 60 * 1000)) / 1000);

  try {
    for (const item of cartItems) {
      const productId = item.id;
      const requestedQuantity = item.quantity;

      try {
        // Atomic claim: fails with ConditionalCheckFailedException if stock < qty
        await updateProductStock(productId, -requestedQuantity);
      } catch (error) {
        const name = error instanceof Error ? error.name : '';
        if (name === 'ConditionalCheckFailedException') {
          throw new Error(
            `Insufficient stock for product ${productId}. Requested: ${requestedQuantity}`,
          );
        }
        throw error;
      }

      decremented.push({ productId, quantity: requestedQuantity });

      const reservationId = `RES-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      reservationsToCreate.push({
        productId,
        reservationId,
        orderId,
        quantity: requestedQuantity,
        createdAt: now,
        expiresAt,
        status: 'active',
      });
      reservationIds.push(reservationId);
    }

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
    // Roll back any stock already claimed
    if (decremented.length > 0) {
      console.log('Rolling back stock decrements due to reservation error');
      for (const item of decremented) {
        try {
          await updateProductStock(item.productId, item.quantity);
        } catch (rollbackError) {
          console.error(
            `Failed to restore stock for ${item.productId}:`,
            rollbackError,
          );
        }
      }
    }
    if (reservationIds.length > 0) {
      console.log('Cleaning up partial reservation rows due to error');
      await cancelReservations(reservationIds, false);
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

      // Stock already decremented at reserve time — only mark confirmed
      await client.send(new PutCommand({
        TableName: STOCK_RESERVATIONS_TABLE,
        Item: {
          ...reservation,
          status: 'confirmed',
          confirmedAt: Date.now(),
        },
      }));
    }
  }
}

/**
 * Cancel reservations and optionally restore stock.
 */
export async function cancelReservations(
  reservationIds: string[],
  restoreStock = true,
): Promise<void> {
  console.log(`Cancelling ${reservationIds.length} stock reservations`, { reservationIds });

  for (const reservationId of reservationIds) {
    const reservations = await client.send(new ScanCommand({
      TableName: STOCK_RESERVATIONS_TABLE,
      FilterExpression: 'reservationId = :reservationId',
      ExpressionAttributeValues: {
        ':reservationId': reservationId,
      },
    }));

    if (reservations.Items && reservations.Items.length > 0) {
      const reservation = reservations.Items[0] as StockReservation;

      if (reservation.status === 'active' && restoreStock) {
        await updateProductStock(reservation.productId, reservation.quantity);
      }

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
 * Confirm reservations for an entire order.
 * Stock was already claimed at reserve time — only flip status.
 */
export async function confirmOrderReservations(orderId: string): Promise<void> {
  const reservations = await getOrderReservations(orderId)
  const activeReservations = reservations.filter(r => r.status === 'active')

  if (activeReservations.length === 0) {
    console.log(`No active reservations to confirm for order ${orderId}`)
    return
  }

  console.log(`Confirming ${activeReservations.length} stock reservations for order ${orderId}`)

  for (const reservation of activeReservations) {
    await client.send(new PutCommand({
      TableName: STOCK_RESERVATIONS_TABLE,
      Item: {
        ...reservation,
        status: 'confirmed',
        confirmedAt: Date.now(),
      },
    }))
  }
}

/**
 * Cancel reservations for an entire order and restore stock
 */
export async function cancelOrderReservations(orderId: string): Promise<void> {
  const reservations = await getOrderReservations(orderId);
  const activeReservationIds = reservations
    .filter(r => r.status === 'active')
    .map(r => r.reservationId);

  if (activeReservationIds.length > 0) {
    await cancelReservations(activeReservationIds, true);
  }
}

/**
 * Cleanup expired reservations and restore stock
 */
export async function cleanupExpiredReservations(): Promise<number> {
  const now = Math.floor(Date.now() / 1000);

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

    for (const reservation of expiredReservations) {
      try {
        await updateProductStock(reservation.productId, reservation.quantity);
      } catch (error) {
        console.error(
          `Failed to restore stock for expired reservation ${reservation.reservationId}:`,
          error,
        );
      }

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
