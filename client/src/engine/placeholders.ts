/**
 * Resolves all placeholders in a prompt text string.
 *
 * {player1}      → random player from the list
 * {player2}      → different random player (≠ player1)
 * {player3}      → third random player (≠ player1, player2)
 * {all_players}  → "Everyone"
 * {sip_count}    → random number between sip_min and sip_max
 * {rule_turns}   → computed rule duration
 */

export interface ResolvedPrompt {
  text: string;
  player1?: string;
  player2?: string;
  player3?: string;
  sipCount?: number;
  ruleTurns?: number;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Pick a player, weighted AWAY from those who have been targeted most.
 * Players with fewer target counts are more likely to be picked.
 */
function pickWeightedPlayer(
  players: string[],
  exclude: string[],
  targetCounts: Record<string, number>
): string | null {
  const available = players.filter((p) => !exclude.includes(p));
  if (available.length === 0) return null;

  // Invert counts to create weights (less targeted = higher weight)
  const maxCount = Math.max(...available.map((p) => targetCounts[p] || 0), 1);
  const weights = available.map((p) => maxCount - (targetCounts[p] || 0) + 1);
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  let roll = Math.random() * totalWeight;
  for (let i = 0; i < available.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return available[i];
  }

  return available[available.length - 1];
}

export function resolvePrompt(
  text: string,
  players: string[],
  targetCounts: Record<string, number>,
  sipMin?: number | null,
  sipMax?: number | null,
  ruleRoundsMin?: number | null,
  ruleRoundsMax?: number | null,
  vipAssignments?: Record<string, string>
): ResolvedPrompt {
  const result: ResolvedPrompt = { text };
  const excluded: string[] = [];

  // Resolve {player1}
  if (text.includes('{player1}')) {
    const p1 = pickWeightedPlayer(players, excluded, targetCounts);
    if (p1) {
      result.player1 = p1;
      excluded.push(p1);
      text = text.replace(/\{player1\}/g, p1);
    }
  }

  // Resolve {player2}
  if (text.includes('{player2}')) {
    const p2 = pickWeightedPlayer(players, excluded, targetCounts);
    if (p2) {
      result.player2 = p2;
      excluded.push(p2);
      text = text.replace(/\{player2\}/g, p2);
    }
  }

  // Resolve {player3}
  if (text.includes('{player3}')) {
    const p3 = pickWeightedPlayer(players, excluded, targetCounts);
    if (p3) {
      result.player3 = p3;
      excluded.push(p3);
      text = text.replace(/\{player3\}/g, p3);
    }
  }

  // Resolve {vip} and {vip2} from VIP assignments map
  if (vipAssignments) {
    if (text.includes('{vip}') && vipAssignments.vip) {
      text = text.replace(/\{vip\}/g, vipAssignments.vip);
    }
    if (text.includes('{vip2}') && vipAssignments.vip2) {
      text = text.replace(/\{vip2\}/g, vipAssignments.vip2);
    }
  }

  // Resolve {all_players}
  text = text.replace(/\{all_players\}/g, 'Everyone');

  // Resolve {sip_count}
  if (text.includes('{sip_count}') && sipMin != null && sipMax != null) {
    const count = randomBetween(sipMin, sipMax);
    result.sipCount = count;
    text = text.replace(/\{sip_count\}/g, String(count));
  }

  // Resolve {rule_turns}
  if (text.includes('{rule_turns}') && ruleRoundsMin != null && ruleRoundsMax != null) {
    const turns = randomBetween(ruleRoundsMin, ruleRoundsMax);
    result.ruleTurns = turns;
    text = text.replace(/\{rule_turns\}/g, String(turns));
  }

  result.text = text;
  return result;
}

// ── Party Mode text transforms ──────────────────────────────────────────────
// Replaces drink references with fun party penalties when in party mode.

const PARTY_REPLACEMENTS: Array<[RegExp, string | ((match: string, ...args: any[]) => string)]> = [
  // "finish your drink" → specific dare
  [/finish your drink/gi, 'do your best celebrity impression'],
  // "take a drink" → party version
  [/take a drink/gi, 'do a silly dance move'],
  // "waterfall" → party chain
  [/waterfall/gi, 'chain — each person tells a joke, keep going until someone can\'t'],
  // "X shots" / "a shot" → party version
  [/(\d+)\s+shots?/gi, (_m: string, n: string) => `${n} dare${Number(n) > 1 ? 's' : ''}`],
  [/a shot/gi, 'a dare'],
  // "X sips" → "X points"
  [/(\d+)\s+sips?/gi, (_m: string, n: string) => `${n} point${Number(n) > 1 ? 's' : ''}`],
  // "{sip_count} sips" (already resolved to a number)
  [/a sip/gi, 'a point'],
  [/sips/gi, 'points'],
  [/sip/gi, 'point'],
  // "your drink is looking" → party version
  [/your drink is looking too full\. Fix that — /gi, ''],
  // Generic drink-related words
  [/\bdrinking\b/gi, 'playing'],
  [/\bdrinks\b/gi, 'dares'],
  [/\bdrink\b/gi, 'dare'],
];

export function applyPartyMode(text: string): string {
  let result = text;
  for (const [pattern, replacement] of PARTY_REPLACEMENTS) {
    if (typeof replacement === 'string') {
      result = result.replace(pattern, replacement);
    } else {
      result = result.replace(pattern, replacement as any);
    }
  }
  return result;
}

/**
 * Resolve the rule_end_text with the same player assignment as the original prompt.
 */
export function resolveRuleEndText(
  ruleEndText: string,
  player1?: string,
  vipAssignments?: Record<string, string>
): string {
  let text = ruleEndText;
  if (player1) {
    text = text.replace(/\{player1\}/g, player1);
  }
  if (vipAssignments) {
    if (vipAssignments.vip) {
      text = text.replace(/\{vip\}/g, vipAssignments.vip);
    }
    if (vipAssignments.vip2) {
      text = text.replace(/\{vip2\}/g, vipAssignments.vip2);
    }
  }
  return text;
}
