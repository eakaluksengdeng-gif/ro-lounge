import type { Card, Suit } from "../../../shared/pokdeng";

const SVG_NS = "http://www.w3.org/2000/svg";

/** Small, code-native pixel sprites: no font-dependent suit glyphs or external image requests. */
function sprite(rows: string[], colors: Record<string, string>, className: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${Math.max(...rows.map(row => row.length))} ${rows.length}`);
  svg.setAttribute("class", className);
  svg.setAttribute("shape-rendering", "crispEdges");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  for (const [y, row] of rows.entries()) for (const [x, pixel] of [...row].entries()) {
    if (!colors[pixel]) continue;
    const rect = document.createElementNS(SVG_NS, "rect");
    for (const [key, value] of Object.entries({ x, y, width: 1, height: 1, fill: colors[pixel] })) rect.setAttribute(key, String(value));
    svg.append(rect);
  }
  return svg;
}

export function goldCoin(): SVGSVGElement {
  return sprite([
    ".....oooooo.....", "...ooddddddoo...", "..oddyyyyyyddo..", ".oddyHHHHyyyydo.",
    ".odyHHyyyyyyydo.", "oddyHyyyLLyyyydo", "odyyyyyLLLLyyydo", "odyyyyLLddLLyydo",
    "odyyyyLLddLLyydo", "odyyyyyLLLLyyydo", "oddyyyyyLLyyyydo", ".odyyyyyyyyyydo.",
    ".oddyyyyyyyyddo.", "..oddddddddddo..", "...ooaaaaaaoo...", ".....oooooo.....",
  ], { o: "#694014", d: "#cf841b", y: "#f8c83d", H: "#fff5b2", L: "#ffe977", a: "#a45b17" }, "pixel-coin");
}

const SUITS: Record<Suit, string[]> = {
  hearts: [".........", ".##...##.", "#########", "#########", ".#######.", "..#####..", "...###...", "....#....", "........."],
  diamonds: ["....#....", "...###...", "..#####..", ".#######.", "#########", ".#######.", "..#####..", "...###...", "....#...."],
  clubs: ["...###...", "..#####..", "...###...", ".##.#.##.", "#########", "#########", ".##.#.##.", "....#....", "...###..."],
  spades: ["....#....", "...###...", "..#####..", ".#######.", "#########", "#########", ".##.#.##.", "....#....", "...###..."],
};
const SUIT_NAMES: Record<Suit, string> = { clubs: "ดอกจิก", diamonds: "ข้าวหลามตัด", hearts: "โพแดง", spades: "โพดำ" };
function suitSprite(suit: Suit): SVGSVGElement {
  return sprite(SUITS[suit], { "#": suit === "hearts" || suit === "diamonds" ? "#bd3846" : "#233344" }, "pixel-suit");
}

type Pip = [number, number];
function pipPositions(rank: number): Pip[] {
  const center: Pip = [50, 50];
  if (rank === 1) return [center];
  if (rank <= 3) return [[50, 15], ...(rank === 3 ? [center] : []), [50, 85]];
  const ys = rank <= 5 ? [15, 85] : rank <= 8 ? [15, 50, 85] : [15, 38, 62, 85];
  const positions: Pip[] = ys.flatMap(y => [[24, y], [76, y]] as Pip[]);
  if (rank === 5 || rank === 9) positions.push(center);
  if (rank === 7 || rank === 8) positions.push([50, 32]);
  if (rank === 8) positions.push([50, 68]);
  if (rank === 10) positions.push([50, 27], [50, 73]);
  return positions;
}

function royalPortrait(rank: number, suit: Suit): SVGSVGElement {
  const crown = rank === 11 ? ["......ggg.....", ".....ggggg....", "....bbbbbb...."]
    : ["...g..g..g....", "...ggggggg....", "....ggggg....."];
  return sprite([...crown,
    "....hhhhhh....", "...hhpppphh...", "...hppkpkph...", "....pppppp....", "....hpmphh....",
    rank === 13 ? "....hhhhhh...." : ".....pppp.....", "..ggbttttbgg..", ".gbbttggttbbg.",
    ".gbbttggttbbg.", "..bbttttttbb..", "...bbbggbbb...",
  ], { g: "#e1b450", b: "#344b68", h: rank === 12 ? "#b97832" : "#563d2a", p: "#efc695", k: "#233344",
    m: "#bd3846", t: suit === "hearts" || suit === "diamonds" ? "#bd3846" : "#344b68" }, "pixel-royal");
}

export function playingCard(card?: Card, large = false): HTMLSpanElement {
  const el = document.createElement("span");
  el.className = "pok-card" + (large ? " large" : "") + (card ? "" : " back");
  el.setAttribute("role", "img");
  if (!card) {
    el.setAttribute("aria-label", "ไพ่คว่ำ");
    const pattern = document.createElement("span");
    pattern.className = "pok-back-pattern";
    pattern.append(sprite(SUITS.diamonds, { "#": "#efd18c" }, "pixel-suit"));
    el.append(pattern);
    return el;
  }
  const rank = ({ 1: "A", 11: "J", 12: "Q", 13: "K" } as Record<number, string>)[card.rank] ?? String(card.rank);
  el.setAttribute("aria-label", rank + " " + SUIT_NAMES[card.suit]);
  el.dataset.rank = String(card.rank);
  el.dataset.suit = card.suit;
  if (card.suit === "hearts" || card.suit === "diamonds") el.classList.add("red");
  for (const corner of ["top", "bottom"]) {
    const index = document.createElement("span");
    index.className = "pok-index " + corner;
    const number = document.createElement("span");
    number.className = "pok-rank";
    number.textContent = rank;
    index.append(number, suitSprite(card.suit));
    el.append(index);
  }
  const center = document.createElement("span");
  center.className = card.rank > 10 ? "pok-face" : "pok-pips";
  if (card.rank > 10) {
    center.append(royalPortrait(card.rank, card.suit), royalPortrait(card.rank, card.suit));
  } else for (const [x, y] of pipPositions(card.rank)) {
    const pip = suitSprite(card.suit);
    pip.classList.add("pok-pip");
    pip.style.left = x + "%";
    pip.style.top = y + "%";
    pip.style.transform = "translate(-50%, -50%)" + (y > 50 ? " rotate(180deg)" : "");
    center.append(pip);
  }
  el.append(center);
  return el;
}

export function coinAmount(amount: number, unit: "prefix" | "suffix"): HTMLSpanElement {
  const badge = document.createElement("span");
  badge.className = "gold-balance";
  badge.dataset.balance = String(amount);
  const label = document.createElement("span");
  label.className = "pok-sr-only";
  label.textContent = unit === "prefix" ? "ชิป " : " ชิป";
  const value = document.createElement("strong");
  value.className = "gold-amount";
  value.textContent = String(amount);
  badge.append(goldCoin(), ...(unit === "prefix" ? [label, value] : [value, label]));
  return badge;
}
