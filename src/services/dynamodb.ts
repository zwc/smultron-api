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

const docClient = DynamoDBDocumentClient.from(client);

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
  const result = await docClient.send(
    new ScanCommand({
      TableName: tableName,
    })
  );
  return (result.Items as T[]) || [];
};

export const queryItems = async <T>(
  tableName: string,
  indexName: string,
  keyConditionExpression: string,
  expressionAttributeValues: Record<string, any>
): Promise<T[]> => {
  const result = await docClient.send(
    new QueryCommand({
      TableName: tableName,
      IndexName: indexName,
      KeyConditionExpression: keyConditionExpression,
      ExpressionAttributeValues: expressionAttributeValues,
    })
  );
  return (result.Items as T[]) || [];
};

export const updateItem = async <T>(
  tableName: string,
  key: Record<string, any>,
  updateExpression: string,
  expressionAttributeValues: Record<string, any>,
  expressionAttributeNames?: Record<string, string>
): Promise<T> => {
  const result = await docClient.send(
    new UpdateCommand({
      TableName: tableName,
      Key: key,
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: expressionAttributeNames,
      ReturnValues: 'ALL_NEW',
    })
  );
  return result.Attributes as T;
};
