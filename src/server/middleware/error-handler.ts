import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';
import { ERROR_CODES } from '../../shared/constants/index';

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function notFoundError(message = 'Resource not found'): AppError {
  return new AppError(ERROR_CODES.NOT_FOUND, message, 404);
}

export function unauthorizedError(message = 'Unauthorized'): AppError {
  return new AppError(ERROR_CODES.UNAUTHORIZED, message, 401);
}

export function forbiddenError(message = 'Forbidden'): AppError {
  return new AppError(ERROR_CODES.FORBIDDEN, message, 403);
}

export function validationError(message: string, details?: unknown): AppError {
  return new AppError(ERROR_CODES.VALIDATION_ERROR, message, 400, details);
}

export function conflictError(message: string): AppError {
  return new AppError(ERROR_CODES.CONFLICT, message, 409);
}

export function errorHandler() {
  return async (c: Context, next: Next) => {
    try {
      await next();
    } catch (error) {
      console.error('Error:', error);

      if (error instanceof AppError) {
        return c.json(
          {
            error: {
              code: error.code,
              message: error.message,
              details: error.details,
            },
          },
          error.status as 400 | 401 | 403 | 404 | 409 | 500
        );
      }

      if (error instanceof ZodError) {
        return c.json(
          {
            error: {
              code: ERROR_CODES.VALIDATION_ERROR,
              message: 'Validation failed',
              details: error.issues,
            },
          },
          400
        );
      }

      if (error instanceof HTTPException) {
        return c.json(
          {
            error: {
              code: error.status === 404 ? ERROR_CODES.NOT_FOUND : ERROR_CODES.INTERNAL_ERROR,
              message: error.message,
            },
          },
          error.status
        );
      }

      // Unknown error
      return c.json(
        {
          error: {
            code: ERROR_CODES.INTERNAL_ERROR,
            message: 'Internal server error',
          },
        },
        500
      );
    }
  };
}
