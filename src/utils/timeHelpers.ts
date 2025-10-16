export function getDynamicTimeRangeFallback(): string {
    const now = new Date();
    const dayOfWeek = now.getDay();

    if (dayOfWeek === 6) {
        return '48h';
    } else if (dayOfWeek === 0) {
        return '72h';
    } else {

        return '24h';
    }
}