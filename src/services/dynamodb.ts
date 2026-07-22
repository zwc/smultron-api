import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  DeleteCommand,
  ScanCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

export const putItem = async (tableName: string, item: any): Promise<void> => {
  await docClient.send(
    new PutCommand({
      TableName: tableName,
      Item: item,
    })
  );
};

export const getItem = async <T>(
  tableName: string,
  key: Record<string, any>
): Promise<T | null> => {
  const result = await docClient.send(
    new GetCommand({
      TableName: tableName,
      Key: key,
    })
  );
  return (result.Item as T) || null;
};

export const deleteItem = async (
  tableName: string,
  key: Record<string, any>
): Promise<void> => {
  await docClient.send(
    new DeleteCommand({
      TableName: tableName,
      Key: key,
    })
  );
};

export const scanTable = async <T>(tableName: string): Promise<T[]> => {
  const items: T[] = []
  let exclusiveStartKey: Record<string, unknown> | undefined

  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey: exclusiveStartKey,
      }),
    )
    if (result.Items?.length) {
      items.push(...(result.Items as T[]))
    }
    exclusiveStartKey = result.LastEvaluatedKey as Record<string, unknown> | undefined
  } while (exclusiveStartKey)

  return items
}

export const queryItems = async <T>(
  tableName: string,
  indexName: string,
  keyConditionExpression: string,
  expressionAttributeValues: Record<string, any>,
  expressionAttributeNames?: Record<string, string>
): Promise<T[]> => {
  const items: T[] = []
  let exclusiveStartKey: Record<string, unknown> | undefined

  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: indexName,
        KeyConditionExpression: keyConditionExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        ExpressionAttributeNames: expressionAttributeNames,
        ExclusiveStartKey: exclusiveStartKey,
      }),
    )
    if (result.Items?.length) {
      items.push(...(result.Items as T[]))
    }
    exclusiveStartKey = result.LastEvaluatedKey as Record<string, unknown> | undefined
  } while (exclusiveStartKey)

  return items
}

export const updateItem = async <T>(
  tableName: string,
  key: Record<string, any>,
  updateExpression: string,
  expressionAttributeValues: Record<string, any>,
  expressionAttributeNames?: Record<string, string>,
  conditionExpression?: string,
): Promise<T> => {
  const result = await docClient.send(
    new UpdateCommand({
      TableName: tableName,
      Key: key,
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: expressionAttributeNames,
      ConditionExpression: conditionExpression,
      ReturnValues: 'ALL_NEW',
    })
  );
  return result.Attributes as T;
};

/**
 * Atomically increments a numeric attribute on an item and returns the new value.
 * Uses DynamoDB's ADD operation which is safe under concurrent writes — two Lambda
 * invocations incrementing the same counter will always receive distinct values.
 * If the item or attribute does not yet exist it is initialised to 1.
 */
export const atomicIncrement = async (
  tableName: string,
  key: Record<string, any>,
  attributeName: string,
): Promise<number> => {
  const result = await docClient.send(
    new UpdateCommand({
      TableName: tableName,
      Key: key,
      UpdateExpression: 'ADD #attr :one',
      ExpressionAttributeNames: { '#attr': attributeName },
      ExpressionAttributeValues: { ':one': 1 },
      ReturnValues: 'ALL_NEW',
    }),
  )
  return result.Attributes?.[attributeName] as number
}
