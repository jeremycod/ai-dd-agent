export function trimErrorMessage(error: string): string {
    const lines = error.split('\n');
    const stackStart = lines.findIndex(line => /^\s*at /.test(line));
    return stackStart === -1
        ? error
        : lines.slice(0, stackStart).join('\n');
}