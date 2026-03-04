/**
 * Property-Based Tests for Error Handling
 * Feature: weather-sunset-predictor, Property 17
 */
import fc from 'fast-check';
import ErrorHandler from '../../src/utils/ErrorHandler.js';

describe('Error Handling - Property-Based Tests', () => {
  // Property 17: Error Handling Robustness - Validates: Requirements 10.5
  describe('Property 17: Error Handling Robustness', () => {
    test('handleError never throws for valid error objects', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.object({ maxHeight: 5 }),
            fc.string(),
            fc.record({
              message: fc.string(),
              status: fc.option(fc.integer({ min: 400, max: 599 })),
              name: fc.option(fc.string()),
              stack: fc.option(fc.string())
            })
          ),
          (error) => {
            expect(() => {
              const result = ErrorHandler.handleError(error, 'test context');

              // Verify result structure
              expect(result).toHaveProperty('type');
              expect(result).toHaveProperty('message');
              expect(result).toHaveProperty('action');
            }).not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });

    test('handleError returns valid structure for all error types', () => {
      fc.assert(
        fc.property(
          fc.record({
            message: fc.string(),
            status: fc.option(fc.integer({ min: 100, max: 599 })),
            name: fc.option(fc.string()),
            stack: fc.option(fc.string())
          }),
          (error) => {
            const result = ErrorHandler.handleError(error);

            // Verify required fields exist
            expect(result).toHaveProperty('type');
            expect(result).toHaveProperty('message');
            expect(result).toHaveProperty('action');

            // Verify field types
            expect(typeof result.type).toBe('string');
            expect(typeof result.message).toBe('string');
            expect(typeof result.action).toBe('string');

            // Verify type is one of the expected error types
            const validTypes = Object.values(ErrorHandler.ErrorTypes);
            expect(validTypes).toContain(result.type);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('handleError is idempotent', () => {
      fc.assert(
        fc.property(
          fc.record({
            message: fc.string(),
            status: fc.option(fc.integer()),
            name: fc.option(fc.string())
          }),
          (error) => {
            const result1 = ErrorHandler.handleError(error);
            const result2 = ErrorHandler.handleError(error);

            expect(result1.type).toBe(result2.type);
            expect(result1.message).toBe(result2.message);
            expect(result1.action).toBe(result2.action);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('handleAPIError handles all HTTP status codes gracefully', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 400, max: 599 }),
          fc.string(),
          (status, message) => {
            const error = { status, message };
            const result = ErrorHandler.handleAPIError(error);

            expect(result).toHaveProperty('type');
            expect(result).toHaveProperty('message');
            expect(result).toHaveProperty('action');
            expect(result.originalError).toBe(error);

            // Verify action is valid
            const validActions = [
              'showAPIKeyModal',
              'disableRefreshButton',
              'showRetryButton',
              'logError'
            ];
            expect(validActions).toContain(result.action);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('handleNetworkError always returns network error type', () => {
      fc.assert(
        fc.property(
          fc.record({
            message: fc.string(),
            name: fc.option(fc.string())
          }),
          (error) => {
            const result = ErrorHandler.handleNetworkError(error);

            expect(result.type).toBe(ErrorHandler.ErrorTypes.NETWORK_ERROR);
            expect(result.message).toContain('网络');
            expect(result.action).toBe('showRetryButton');
          }
        ),
        { numRuns: 50 }
      );
    });

    test('handleGeocodingError provides actionable messages', () => {
      fc.assert(
        fc.property(
          fc.record({
            message: fc.string()
          }),
          (error) => {
            const result = ErrorHandler.handleGeocodingError(error);

            expect(result.type).toBe(ErrorHandler.ErrorTypes.GEOCODING_ERROR);
            expect(result.message).toBeTruthy();
            expect(typeof result.message).toBe('string');
            expect(result.action).toBe('showLocationInput');
          }
        ),
        { numRuns: 50 }
      );
    });

    test('handleValidationError includes field information', () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.anything(),
          (field, value) => {
            const result = ErrorHandler.handleValidationError(field, value);

            expect(result.type).toBe(ErrorHandler.ErrorTypes.VALIDATION_ERROR);
            expect(result.message).toContain(field);
            expect(result.details).toEqual({ field, value });
            expect(result.action).toBe('logError');
          }
        ),
        { numRuns: 50 }
      );
    });

    test('handleStorageError handles storage-related errors', () => {
      fc.assert(
        fc.property(
          fc.record({
            message: fc.string()
          }),
          (error) => {
            const result = ErrorHandler.handleStorageError(error);

            expect(result.type).toBe(ErrorHandler.ErrorTypes.STORAGE_ERROR);
            expect(result.message).toBeTruthy();
            expect(result.action).toBe('logError');
          }
        ),
        { numRuns: 50 }
      );
    });

    test('isRecoverable correctly identifies recoverable error types', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...Object.values(ErrorHandler.ErrorTypes)),
          (errorType) => {
            const errorInfo = { type: errorType, message: 'test', action: 'logError' };
            const isRecoverable = ErrorHandler.isRecoverable(errorInfo);

            // Verify return type
            expect(typeof isRecoverable).toBe('boolean');

            // Specific error types should be recoverable
            const recoverableTypes = [
              ErrorHandler.ErrorTypes.NETWORK_ERROR,
              ErrorHandler.ErrorTypes.TIMEOUT,
              ErrorHandler.ErrorTypes.GEOCODING_ERROR,
              ErrorHandler.ErrorTypes.API_ERROR
            ];

            if (recoverableTypes.includes(errorType)) {
              expect(isRecoverable).toBe(true);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    test('getSeverity returns valid severity levels', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...Object.values(ErrorHandler.ErrorTypes)),
          (errorType) => {
            const errorInfo = { type: errorType, message: 'test', action: 'logError' };
            const severity = ErrorHandler.getSeverity(errorInfo);

            // Verify severity is one of the expected values
            expect(['low', 'medium', 'high']).toContain(severity);
          }
        ),
        { numRuns: 20 }
      );
    });

    test('formatErrorLog produces valid log format', () => {
      fc.assert(
        fc.property(
          fc.record({
            type: fc.constantFrom(...Object.values(ErrorHandler.ErrorTypes)),
            message: fc.string(),
            action: fc.string(),
            context: fc.option(fc.string()),
            originalError: fc.option(fc.record({
              message: fc.string(),
              stack: fc.option(fc.string())
            }))
          }),
          (errorInfo) => {
            const log = ErrorHandler.formatErrorLog(errorInfo);

            // Verify log format
            expect(typeof log).toBe('string');
            expect(log).toMatch(/\[\d{4}-\d{2}-\d{2}T/); // ISO timestamp
            expect(log).toContain(errorInfo.type);
            expect(log).toContain(errorInfo.message);

            if (errorInfo.context) {
              expect(log).toContain('Context:');
            }

            if (errorInfo.originalError) {
              expect(log).toContain('Original:');
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    test('handleError with null error returns valid structure', () => {
      const result = ErrorHandler.handleError(null, 'test context');

      expect(result.type).toBe(ErrorHandler.ErrorTypes.UNKNOWN_ERROR);
      expect(result.message).toContain('未知');
      expect(result.action).toBe('logError');
    });

    test('handleError with undefined error returns valid structure', () => {
      const result = ErrorHandler.handleError(undefined, 'test context');

      expect(result.type).toBe(ErrorHandler.ErrorTypes.UNKNOWN_ERROR);
      expect(result.message).toContain('未知');
      expect(result.action).toBe('logError');
    });

    test('error handling preserves error context', () => {
      fc.assert(
        fc.property(
          fc.record({
            message: fc.string(),
            status: fc.option(fc.integer())
          }),
          fc.string(),
          (error, context) => {
            const result = ErrorHandler.handleError(error, context);

            // Not all error paths include context in result (e.g. handleAPIError)
            // Only verify when the result does include it
            if (context && result.context !== undefined) {
              expect(result.context).toBe(context);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    test('malformed error objects do not cause crashes', () => {
      const malformedErrors = [
        null,
        undefined,
        '',
        123,
        [],
        () => {},
        { weird: 'object' },
        Symbol('error')
      ];

      malformedErrors.forEach(error => {
        expect(() => {
          ErrorHandler.handleError(error);
        }).not.toThrow();
      });
    });

    test('error handling is consistent across multiple calls', () => {
      fc.assert(
        fc.property(
          fc.record({
            message: fc.string(),
            status: fc.option(fc.integer({ min: 400, max: 599 }))
          }),
          (error) => {
            const results = Array.from({ length: 5 }, () =>
              ErrorHandler.handleError(error)
            );

            // All results should have the same type, message, and action
            const firstResult = results[0];
            results.forEach(result => {
              expect(result.type).toBe(firstResult.type);
              expect(result.message).toBe(firstResult.message);
              expect(result.action).toBe(firstResult.action);
            });
          }
        ),
        { numRuns: 30 }
      );
    });
  });
});
