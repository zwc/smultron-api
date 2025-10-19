import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { APIResponse } from '../types';

export const handler = async (_event: APIGatewayProxyEvent): Promise<APIResponse> => {
  // Intentionally throw to test error reporting
  throw new Error('Ping error test - intentional 500');
};
