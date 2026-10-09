import { randomInt } from "node:crypto";
import type { Card, HandKind, HandValue, Suit } from "../../../shared/pokdeng";
import { requireGame } from "./errors";

export interface Rules {
  minBet: number;
  actionMs: number;
  dealingMs: number;
  checkPokMs: number;
  showdownMs: number;
  bettingMs: number;
  reconnectMs: number;
  multipliers: Record<HandKind, number>;
  ranking: Record<HandKind, number>;
}

/** House rules: Pok > tong > straight > sian > ordinary points; ties push. */
export const DEFAULT_RULES: Rules = {
  minBet: 10, actionMs: 15_000, dealingMs: 500, checkPokMs: 500,
  showdownMs: 8_000, bettingMs: 8_000, reconnectMs: 60_000,
  multipliers: { points: 1, sian: 3, straight: 3, tong: 5, pok8: 1, pok9: 1 },
  ranking: { points: 0, sian: 100, straight: 200, tong: 300, pok8: 400, pok9: 500 },
};

export function createDeck(): Card[] {
  const suits: Suit[] = ["clubs", "diamonds", "hearts", "spades"];
  return suits.flatMap(suit => Array.from({ length: 13 }, (_, i) => ({ rank: i + 1, suit })));
}

export function shuffledDeck(): Card[] {
  const deck = createDeck();
  for (let i = deck.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function points(cards: Card[]): number {
  return cards.reduce((sum, card) => sum + Math.min(card.rank, 10), 0) % 10;
}

export function isPok(cards: Card[]): boolean {
  return cards.length === 2 && points(cards) >= 8;
}

export function evaluate(cards: Card[], rules: Rules = DEFAULT_RULES): HandValue {
  requireGame(cards.length === 2 || cards.length === 3, "BAD_HAND", "Expected two or three cards");
  const score = points(cards);
  const sameSuit = cards.every(c => c.suit === cards[0].suit);
  const sameRank = cards.every(c => c.rank === cards[0].rank);
  let kind: HandKind = "points";
  if (isPok(cards)) {
    kind = score === 9 ? "pok9" : "pok8";
  } else if (cards.length === 3) {
    const ranks = cards.map(c => c.rank).sort((a, b) => a - b);
    const straight = ranks[1] === ranks[0] + 1 && ranks[2] === ranks[1] + 1;
    if (sameRank) kind = "tong";
    else if (straight) kind = "straight";
    else if (cards.every(c => c.rank >= 11)) kind = "sian";
  }
  const deng = sameSuit ? (cards.length === 2 ? 2 : 3) : cards.length === 2 && sameRank ? 2 : 1;
  const multiplier = kind === "points" || kind === "pok8" || kind === "pok9"
    ? Math.max(rules.multipliers[kind], deng) : rules.multipliers[kind];
  return { kind, points: score, multiplier, strength: rules.ranking[kind] + (kind === "points" ? score : 0) };
}

export function maximumMultiplier(rules: Rules): number {
  return Math.max(3, ...Object.values(rules.multipliers));
}
