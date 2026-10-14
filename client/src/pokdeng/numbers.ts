// Presentation only: Arabic digits with thousands separators, never applied to bets/API payloads.
const integerFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
export const formatNumber = (value: number): string => integerFormat.format(value === 0 ? 0 : value);
export const formatDelta = (value: number): string => (value > 0 ? "+" : "") + formatNumber(value);
