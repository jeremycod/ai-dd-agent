import {ZodError} from "zod";
import {logger} from './logger';

export function safeJsonStringify(obj: any, indent = 2): string {
    const cache = new Set();
    const replacer = (key: string, value: any) => {
        if (typeof value === 'object' && value !== null) {
            if (cache.has(value)) {
                // Circular reference found, discard key
                return;
            }
            // Store value in our collection
            cache.add(value);

            // --- NEW: Handle Error instances explicitly ---
            if (value instanceof Error) {
                // Create a plain object to include non-enumerable Error properties
                const errorLike = {
                    name: value.name,
                    message: value.message,
                    stack: value.stack,
                    // Copy any other enumerable properties (like ZodError.issues)
                    ...(Object.getOwnPropertyNames(value).reduce((acc: Record<string, any>, propName) => {
                        // Ensure we don't overwrite name, message, stack
                        if (!['name', 'message', 'stack'].includes(propName)) {
                            acc[propName] = (value as any)[propName];
                        }
                        return acc;
                    }, {}))
                };
                // If it's a ZodError, ensure 'issues' is copied
                if (value instanceof ZodError && value.issues) {
                    (errorLike as any).issues = value.issues;
                }
                // If it's a LangChain error that might have a 'toolInput' or 'cause'
                if ((value as any).toolInput) {
                    (errorLike as any).toolInput = (value as any).toolInput;
                }
                if ((value as any).cause) {
                    (errorLike as any).cause = (value as any).cause; // Recursively stringify cause later if it's an object
                }
                return errorLike;
            }
        }
        return value;
    };

    try {
        return JSON.stringify(obj, replacer, indent);
    } catch (e) {
        // Fallback for extreme cases where stringify still fails (e.g., deeply nested non-serializable objects)
        logger.error('Failed to stringify object for logging:', e);
        return '[Failed to stringify object]';
    }
}