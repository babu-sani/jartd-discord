// ── Core Game Types ──────────────────────────────────────────────────────────

export interface Prompt {
  prompt_id: string;
  category: Category;
  prompt_type: PromptType;
  text: string;
  answer: string | null;
  rule_end_text: string | null;
  min_players: number;
  max_players: number;
  adult: boolean;
  weight: number;
  cooldown: number;
  max_uses_per_game: number | null;
  tags: string[];
  shot_fallback_sips: number | null;
  sip_min: number | null;
  sip_max: number | null;
  rule_rounds_min: number | null;
  rule_rounds_max: number | null;
  ui_hint: UiHint;
  group_min_qualify: number | null;
  enabled: boolean;
  notes: string | null;
  requires_vip2?: boolean;
}

export type Category =
  | 'Opening'
  | 'Single'
  | 'Distribution'
  | 'Group'
  | 'Vote'
  | 'Duel'
  | 'Rule'
  | 'Challenge'
  | 'Penalty'
  | 'Callback'
  | 'Special';

export type PromptType =
  | 'single'
  | 'distribute'
  | 'group'
  | 'vote'
  | 'duel'
  | 'rule'
  | 'challenge'
  | 'callback';

export type UiHint = 'default' | 'crown' | 'point_up' | 'vote' | 'duel' | 'timer';

export interface PackManifest {
  pack_id: string;
  title: string;
  description: string;
  version: string;
  price_usd: number;
  is_free: boolean;
  is_adult_pack: boolean;
  prompt_count: number;
  data_file: string;
  thumbnail: string;
  sort_order: number;
  enabled: boolean;
  release_date: string | null;
}

export interface VipRole {
  key: 'vip' | 'vip2';
  label: string;       // e.g. "bride", "groom"
  prompt: string;       // e.g. "Who's the bride?"
  required: boolean;
}

export interface PackData {
  pack_id: string;
  generated_at: string;
  total_prompts: number;
  schema_version: string;
  prompts: Prompt[];
  vip_roles?: VipRole[];
}

// ── Active Rule Tracking ─────────────────────────────────────────────────────

export interface ActiveRule {
  prompt_id: string;
  text: string;
  rule_end_text: string;
  rounds_remaining: number;
  assigned_player: string;
}

// ── Game Session State ───────────────────────────────────────────────────────

export interface GameSession {
  players: string[];
  round: number;
  active_rules: ActiveRule[];
  history: HistoryEntry[];
  prompt_usage: Record<string, number>;       // prompt_id -> times used
  prompt_cooldowns: Record<string, number>;    // prompt_id -> rounds until available
  player_target_count: Record<string, number>; // player -> times targeted
  settings: GameSettings;
  is_active: boolean;
  vip_assignments?: Record<string, string>;   // e.g. { vip: "Sarah", vip2: "Mike" }
}

export interface HistoryEntry {
  round: number;
  prompt_id: string;
  category: Category;
  resolved_text: string;
  player1?: string;
  player2?: string;
  player3?: string;
  was_rule_end?: boolean;
}

export type GameMode = 'drinks' | 'party';

export interface GameSettings {
  adult_mode: boolean;
  shots_enabled: boolean;
  intensity: 'chill' | 'normal' | 'wild' | 'chaos';
  selected_packs: string[];
  game_mode: GameMode;
}

export const DEFAULT_SETTINGS: GameSettings = {
  adult_mode: false,
  shots_enabled: false,
  intensity: 'normal',
  selected_packs: ['jartd_base_game', 'globe_trotters'],
  game_mode: 'party',
};
