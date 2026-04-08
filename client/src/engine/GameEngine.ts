import {
  Prompt,
  ActiveRule,
  GameSession,
  GameSettings,
  HistoryEntry,
  DEFAULT_SETTINGS,
  PackData,
} from './types';
import { resolvePrompt, resolveRuleEndText, applyPartyMode, ResolvedPrompt } from './placeholders';

/**
 * JARTD Game Engine
 *
 * Handles all game logic:
 * - Prompt selection with weighting, cooldowns, and max-uses
 * - Opening prompts guaranteed first
 * - Player balance (targets less-targeted players)
 * - Active rule tracking with automatic expiry
 * - Intensity scaling
 * - Shot/adult filtering
 */

// Intensity multipliers for prompt weights
const INTENSITY_MULTIPLIERS: Record<string, Record<string, number>> = {
  chill:  { Single: 1.5, Distribution: 1.2, Group: 1.3, Vote: 1.0, Duel: 0.8, Rule: 0.5, Challenge: 0.6, Penalty: 0.2, Callback: 1, Special: 0.5 },
  normal: { Single: 1.0, Distribution: 1.0, Group: 1.0, Vote: 1.0, Duel: 1.0, Rule: 1.0, Challenge: 1.0, Penalty: 1.0, Callback: 1, Special: 1.0 },
  wild:   { Single: 0.8, Distribution: 1.0, Group: 1.0, Vote: 1.2, Duel: 1.3, Rule: 1.2, Challenge: 1.3, Penalty: 1.5, Callback: 1, Special: 1.3 },
  chaos:  { Single: 0.5, Distribution: 0.8, Group: 1.0, Vote: 1.5, Duel: 1.5, Rule: 1.5, Challenge: 1.5, Penalty: 2.0, Callback: 1, Special: 1.5 },
};

export interface DrawnCard {
  prompt: Prompt;
  resolved: ResolvedPrompt;
  isRuleEnd: boolean;
  expiredRule?: ActiveRule;
}

export class GameEngine {
  private prompts: Prompt[] = [];
  private session: GameSession;
  private vipAssignments: Record<string, string>;

  constructor(
    packs: PackData[],
    players: string[],
    settings?: Partial<GameSettings>,
    vipAssignments?: Record<string, string>
  ) {
    this.vipAssignments = vipAssignments || {};
    const hasVip2 = !!this.vipAssignments.vip2;

    // Merge all enabled prompts from selected packs
    for (const pack of packs) {
      this.prompts.push(
        ...pack.prompts.filter((p) => {
          if (!p.enabled) return false;
          // Filter out prompts that require vip2 when vip2 isn't assigned
          if (p.requires_vip2 && !hasVip2) return false;
          return true;
        })
      );
    }

    // Initialize session
    const mergedSettings = { ...DEFAULT_SETTINGS, ...settings };
    this.session = {
      players,
      round: 0,
      active_rules: [],
      history: [],
      prompt_usage: {},
      prompt_cooldowns: {},
      player_target_count: Object.fromEntries(players.map((p) => [p, 0])),
      settings: mergedSettings,
      is_active: true,
      vip_assignments: vipAssignments,
    };
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /** Draw the next card. Returns null if no valid prompts remain. */
  drawCard(): DrawnCard | null {
    this.session.round++;

    // 1. Check for expired rules first — show rule-end card
    const expiredRule = this.checkExpiredRules();
    if (expiredRule) {
      const resolvedEndText = resolveRuleEndText(
        expiredRule.rule_end_text,
        expiredRule.assigned_player,
        this.vipAssignments
      );

      const entry: HistoryEntry = {
        round: this.session.round,
        prompt_id: expiredRule.prompt_id,
        category: 'Callback',
        resolved_text: resolvedEndText,
        was_rule_end: true,
      };
      this.session.history.push(entry);

      return {
        prompt: this.createRuleEndPrompt(resolvedEndText),
        resolved: { text: resolvedEndText },
        isRuleEnd: true,
        expiredRule,
      };
    }

    // 2. Opening prompts for first 2 rounds
    if (this.session.round <= 2) {
      const opening = this.drawOpening();
      if (opening) return opening;
    }

    // 3. Regular weighted draw
    return this.drawWeighted();
  }

  /** Get current session state */
  getSession(): GameSession {
    return { ...this.session };
  }

  /** Get active rules */
  getActiveRules(): ActiveRule[] {
    return [...this.session.active_rules];
  }

  /** Get game history */
  getHistory(): HistoryEntry[] {
    return [...this.session.history];
  }

  /** Get current round number */
  getRound(): number {
    return this.session.round;
  }

  /** Check if game is still active */
  isActive(): boolean {
    return this.session.is_active;
  }

  /** End the game */
  endGame(): void {
    this.session.is_active = false;
  }

  /** Get player stats */
  getPlayerStats(): Record<string, number> {
    return { ...this.session.player_target_count };
  }

  // ── Internal Logic ───────────────────────────────────────────────────────

  private drawOpening(): DrawnCard | null {
    const openings = this.prompts.filter(
      (p) => p.category === 'Opening' && !this.session.prompt_usage[p.prompt_id]
    );
    if (openings.length === 0) return null;

    const prompt = openings[Math.floor(Math.random() * openings.length)];
    return this.resolveAndRecord(prompt);
  }

  private drawWeighted(): DrawnCard | null {
    const eligible = this.getEligiblePrompts();
    if (eligible.length === 0) return null;

    // Weighted random selection
    const intensity = this.session.settings.intensity;
    const multipliers = INTENSITY_MULTIPLIERS[intensity] || INTENSITY_MULTIPLIERS.normal;

    const weights = eligible.map((p) => {
      const base = p.weight;
      const mult = multipliers[p.category] || 1;
      return Math.max(base * mult, 0.1);
    });

    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let roll = Math.random() * totalWeight;

    for (let i = 0; i < eligible.length; i++) {
      roll -= weights[i];
      if (roll <= 0) {
        return this.resolveAndRecord(eligible[i]);
      }
    }

    // Fallback
    return this.resolveAndRecord(eligible[eligible.length - 1]);
  }

  private getEligiblePrompts(): Prompt[] {
    const { settings, prompt_usage, prompt_cooldowns, players } = this.session;
    const playerCount = players.length;

    return this.prompts.filter((p) => {
      // Skip openings after round 2
      if (p.category === 'Opening') return false;

      // Skip callbacks (they're injected by rule expiry)
      if (p.category === 'Callback') return false;

      // Player count check
      if (playerCount < p.min_players || playerCount > p.max_players) return false;

      // Adult filter
      if (p.adult && !settings.adult_mode) return false;

      // Shot filter
      if (p.shot_fallback_sips && !settings.shots_enabled) {
        // Allow if it has a fallback, skip if shots_only
        if ((p.tags || []).includes('shot') && !p.shot_fallback_sips) return false;
      }

      // Max uses check
      if (p.max_uses_per_game != null) {
        const used = prompt_usage[p.prompt_id] || 0;
        if (used >= p.max_uses_per_game) return false;
      }

      // Cooldown check
      if (prompt_cooldowns[p.prompt_id] && prompt_cooldowns[p.prompt_id] > 0) {
        return false;
      }

      return true;
    });
  }

  private resolveAndRecord(prompt: Prompt): DrawnCard {
    // Resolve placeholders
    const resolved = resolvePrompt(
      prompt.text,
      this.session.players,
      this.session.player_target_count,
      prompt.sip_min,
      prompt.sip_max,
      prompt.rule_rounds_min,
      prompt.rule_rounds_max,
      this.vipAssignments
    );

    // Apply party mode text transforms
    if (this.session.settings.game_mode === 'party') {
      resolved.text = applyPartyMode(resolved.text);
    }

    // Track usage
    this.session.prompt_usage[prompt.prompt_id] =
      (this.session.prompt_usage[prompt.prompt_id] || 0) + 1;

    // Set cooldown
    this.session.prompt_cooldowns[prompt.prompt_id] = prompt.cooldown;

    // Decrement all cooldowns
    for (const pid of Object.keys(this.session.prompt_cooldowns)) {
      if (pid !== prompt.prompt_id) {
        this.session.prompt_cooldowns[pid] = Math.max(
          0,
          (this.session.prompt_cooldowns[pid] || 0) - 1
        );
      }
    }

    // Track player targeting
    if (resolved.player1) {
      this.session.player_target_count[resolved.player1] =
        (this.session.player_target_count[resolved.player1] || 0) + 1;
    }

    // Handle rule prompts — add to active rules
    if (prompt.prompt_type === 'rule' && prompt.rule_end_text) {
      const ruleDuration =
        resolved.ruleTurns ||
        (prompt.rule_rounds_min != null && prompt.rule_rounds_max != null
          ? Math.floor(
              Math.random() * (prompt.rule_rounds_max - prompt.rule_rounds_min + 1) +
                prompt.rule_rounds_min
            )
          : 3);

      let resolvedEndText = resolveRuleEndText(
        prompt.rule_end_text,
        resolved.player1,
        this.vipAssignments
      );
      if (this.session.settings.game_mode === 'party') {
        resolvedEndText = applyPartyMode(resolvedEndText);
      }

      this.session.active_rules.push({
        prompt_id: prompt.prompt_id,
        text: resolved.text,
        rule_end_text: resolvedEndText,
        rounds_remaining: ruleDuration,
        assigned_player: resolved.player1 || '',
      });
    }

    // Decrement active rule durations
    for (const rule of this.session.active_rules) {
      rule.rounds_remaining--;
    }

    // Record history
    const entry: HistoryEntry = {
      round: this.session.round,
      prompt_id: prompt.prompt_id,
      category: prompt.category,
      resolved_text: resolved.text,
      player1: resolved.player1,
      player2: resolved.player2,
      player3: resolved.player3,
    };
    this.session.history.push(entry);

    return { prompt, resolved, isRuleEnd: false };
  }

  /** Check if any rules have expired and remove them */
  private checkExpiredRules(): ActiveRule | null {
    const expired = this.session.active_rules.find((r) => r.rounds_remaining <= 0);
    if (expired) {
      this.session.active_rules = this.session.active_rules.filter(
        (r) => r.prompt_id !== expired.prompt_id
      );
      return expired;
    }
    return null;
  }

  /** Create a synthetic prompt object for rule-end display */
  private createRuleEndPrompt(text: string): Prompt {
    return {
      prompt_id: 'rule_end',
      category: 'Callback',
      prompt_type: 'callback',
      text,
      answer: null,
      rule_end_text: null,
      min_players: 2,
      max_players: 20,
      adult: false,
      weight: 0,
      cooldown: 0,
      max_uses_per_game: null,
      tags: ['callback', 'rule_end'],
      shot_fallback_sips: null,
      sip_min: null,
      sip_max: null,
      rule_rounds_min: null,
      rule_rounds_max: null,
      ui_hint: 'default',
      group_min_qualify: null,
      enabled: true,
      notes: null,
    };
  }
}
