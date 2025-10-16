import {ZodError} from "zod";
import {logger} from './logger';

export function safeJsonStringify(obj: any, indent = 2, maxDepth = 10, maxProperties = 1000): string {
    const cache = new Set();
    let propertyCount = 0;
    
    const replacer = (key: string, value: any, depth = 0) => {

        if (depth > maxDepth) {
            return '[Max depth exceeded]';
        }
        

        if (propertyCount > maxProperties) {
            return '[Max properties exceeded]';
        }
        
        if (typeof value === 'object' && value !== null) {
            propertyCount++;
            
            if (cache.has(value)) {

                return '[Circular reference]';
            }

            cache.add(value);


            if (value instanceof Error) {
                const errorLike: Record<string, any> = {
                    name: value.name,
                    message: value.message,
                    stack: value.stack ? value.stack.split('\n').slice(0, 10).join('\n') : undefined
                };
                

                try {
                    const propNames = Object.getOwnPropertyNames(value).slice(0, 50);
                    for (const propName of propNames) {
                        if (!['name', 'message', 'stack'].includes(propName)) {
                            errorLike[propName] = (value as any)[propName];
                        }
                    }
                } catch (e) {
                    errorLike._propertyEnumerationError = 'Failed to enumerate properties';
                }
                

                if (value instanceof ZodError && value.issues) {
                    errorLike.issues = value.issues;
                }
                if ((value as any).toolInput) {
                    errorLike.toolInput = (value as any).toolInput;
                }
                if ((value as any).cause) {
                    errorLike.cause = (value as any).cause;
                }
                return errorLike;
            }
            

            if (Array.isArray(value)) {
                if (value.length > 100) {
                    return [...value.slice(0, 100), `[... ${value.length - 100} more items]`];
                }
            }
            

            if (Object.keys(value).length > 100) {
                const limitedObj: Record<string, any> = {};
                const keys = Object.keys(value).slice(0, 100);
                for (const k of keys) {
                    limitedObj[k] = value[k];
                }
                limitedObj._truncated = `Object had ${Object.keys(value).length} properties, showing first 100`;
                return limitedObj;
            }
        }
        return value;
    };

    try {
        return JSON.stringify(obj, replacer, indent);
    } catch (e) {

        logger.error('Failed to stringify object for logging:', e instanceof Error ? e.message : String(e));
        return `[Failed to stringify object: ${e instanceof Error ? e.message : String(e)}]`;
    }
}