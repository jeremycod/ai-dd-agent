export function getDynamicTimeRangeFallback(): string {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 for Sunday, 1 for Monday, ..., 6 for Saturday

    if (dayOfWeek === 6) { // Saturday
        return '48h'; // Covers Friday and Saturday
    } else if (dayOfWeek === 0) { // Sunday
        return '72h'; // Covers Friday, Saturday, and Sunday
    } else {
        // Weekday (Monday to Friday)
        return '24h';
    }
}