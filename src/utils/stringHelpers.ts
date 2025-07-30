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