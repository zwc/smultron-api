import { z } from 'zod';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { APIResponse } from '../types';
import { updateCategoryIndex } from '../services/product';
import { verifyAuthToken } from '../middleware/auth';
import { successResponse, errorResponse, unauthorizedResponse } from '../utils/response';

// Request body validation schema
const UpdateIndexesSchema = z.object({
  updates: z.array(
    z.object({
      id: z.string(),
      index: z.number().int()
    })
  ).min(1).max(100) // Limit to 100 updates at once
});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIResponse> => {
  try {
    // Verify authentication
    if (!verifyAuthToken(event.headers)) {
      return unauthorizedResponse();
    }

    // Parse and validate request body
    if (!event.body) {
      return errorResponse('Request body is required', 400);
    }

    const body = JSON.parse(event.body);
    const validatedBody = UpdateIndexesSchema.parse(body);

    // Update all category indexes
    const results = await Promise.allSettled(
      validatedBody.updates.map(update => 
        updateCategoryIndex(update.id, update.index)
      )
    );

    // Check for any failures
    const failures = results
      .map((result, idx) => ({ result, update: validatedBody.updates[idx] }))
      .filter(({ result }) => result.status === 'rejected');

    if (failures.length > 0) {
      const errorDetails = failures.map(({ update, result }) => ({
        id: update?.id || 'unknown',
        error: result.status === 'rejected' ? result.reason?.message : 'Unknown error'
      }));

      console.error('Failed to update some category indexes:', errorDetails);
      return errorResponse(`Failed to update ${failures.length} category index(es)`, 400);
    }

    // Return success with count of updated categories
    return successResponse({
      updated: validatedBody.updates.length,
      message: `Successfully updated ${validatedBody.updates.length} category index(es)`
    });

  } catch (error) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      console.error('Validation error:', error.issues);
      return errorResponse('Invalid request body', 400);
    }

    console.error('Error updating category indexes:', error);
    return errorResponse('Internal server error', 500);
  }
};
