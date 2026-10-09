/** Wire contract. Never include guest session credentials in public table messages. */
export type Suit = "clubs" | "diamonds" | "hearts" | "spades";
export interface Card { rank: number; suit: Suit }
export type Phase = "betting" | "dealing" | "check_pok" | "action" | "showdown";
export type HandKind = "points" | "sian" | "straight" | "tong" | "pok8" | "pok9";
export interface HandValue { kind: HandKind; points: number; multiplier: number; strength: number }
export interface WalletView { balance: number; reserved: number; available: number }
export interface GuestReady {
  sessionId: string; // Private UUID bearer credential; different from Colyseus room.sessionId.
  playerId: string; // Public identity, safe to include in table state.
  wallet: WalletView;
  resumed: boolean;
}
export interface CasinoEntry { ticket: string; expiresAt: number; roomType: "pok_deng"; resumeRoomId?: string }
export interface SeatView {
  seat: number;
  playerId: string;
  name: string;
  connected: boolean;
  dealer: boolean;
  bet: number;
  cardCount: number;
  acted: boolean;
  cards?: Card[]; // Only a Pok hand during check/action, or any hand after showdown.
  value?: HandValue;
}
export interface RoundResult {
  playerId: string;
  outcome: "win" | "lose" | "tie";
  delta: number;
  multiplier: number;
}
export interface TableState {
  roomId: string;
  roundId: string | null;
  phase: Phase;
  serverTime: number;
  deadline: number | null;
  dealerSeat: 0;
  minBet: number;
  maxMultiplier: number;
  seats: (SeatView | null)[]; // Exactly eight, seat 0 belongs to the dealer.
  results: RoundResult[];
}
export interface PrivateHand {
  roundId: string | null;
  cards: Card[];
  canDraw: boolean;
  canStay: boolean;
  deadline: number | null;
}
export interface ApiError { event: string; code: string; message: string }

export interface TownCasinoClientEvents {
  "auth:sync": Record<string, never>;
  "wallet:sync": Record<string, never>;
  "casino:locate": Record<string, never>;
  "casino:enter": Record<string, never>;
}
export interface TownCasinoServerEvents {
  "auth:ready": GuestReady;
  "wallet:update": WalletView;
  "casino:door": { x: number; y: number; radius: number };
  "casino:entered": CasinoEntry;
  "api:error": ApiError;
}

export interface PokClientEvents {
  "auth:sync": Record<string, never>;
  "wallet:sync": Record<string, never>;
  "table:sync": Record<string, never>;
  "table:sit": { seat: number };
  "table:stand": Record<string, never>;
  "table:leave": Record<string, never>;
  "game:bet": { amount: number };
  "game:cancel_bet": Record<string, never>;
  "game:start": Record<string, never>;
  "game:draw": { roundId: string };
  "game:stay": { roundId: string };
}
export interface PokServerEvents {
  "auth:ready": GuestReady;
  "wallet:update": WalletView;
  "table:state": TableState;
  "game:hand": PrivateHand;
  "api:error": ApiError;
}
