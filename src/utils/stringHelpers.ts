import { HumanMessage, AIMessage } from '@langchain/core/messages';

export function trimErrorMessage(error: string): string {
    if (!error || typeof error !== 'string') {
        return '';
    }
    const lines = error.split('\n');
    const stackStart = lines.findIndex(line => /^\s*at /.test(line));
    return stackStart === -1
        ? error
        : lines.slice(0, stackStart).join('\n');
}

export function generateNewHumanMessage(content: string) {
    return new HumanMessage(content);
}

export function generateNewAIMessage(content: string) {
    return new AIMessage(content);
}