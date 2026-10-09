export class GameError extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
}

export function requireGame(condition: unknown, code: string, message: string): asserts condition {
  if (!condition) throw new GameError(code, message);
}

export function objectPayload(value: unknown): Record<string, unknown> {
  requireGame(value !== null && typeof value === "object" && !Array.isArray(value), "BAD_PAYLOAD", "Expected an object");
  return value as Record<string, unknown>;
}
