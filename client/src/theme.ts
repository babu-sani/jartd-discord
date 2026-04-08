import type { Category } from './engine/types';

export const Colors = {
  midnight_navy:   '#0F0E17',
  deep_charcoal:   '#1A1A2E',
  electric_coral:  '#FF6B6B',
  teal_surge:      '#2EC4B6',
  amber_gold:      '#F4A261',
  clean_white:     '#FFFFFE',
  muted_lavender:  '#A7A9BE',
  soft_purple:     '#C77DFF',
  lime_spark:      '#00F5D4',
  deep_red:        '#E63946',
  warm_gray:       '#2D2D3A',
  glass_white:     'rgba(255,255,255,0.1)',
};

export const CategoryBg: Record<Category, string> = {
  Opening:      '#1A1408',
  Single:       '#0B1A1A',
  Distribution: '#0F1520',
  Group:        '#081A16',
  Vote:         '#0D1A12',
  Duel:         '#1A1008',
  Rule:         '#14081A',
  Challenge:    '#1A0C0C',
  Penalty:      '#1A0A14',
  Callback:     '#151518',
  Special:      '#1A1505',
};

export const CategoryAccent: Record<Category, string> = {
  Opening:      Colors.amber_gold,
  Single:       Colors.teal_surge,
  Distribution: '#64B5F6',
  Group:        Colors.lime_spark,
  Vote:         '#66FF99',
  Duel:         Colors.amber_gold,
  Rule:         Colors.soft_purple,
  Challenge:    Colors.electric_coral,
  Penalty:      '#FF66B2',
  Callback:     Colors.muted_lavender,
  Special:      '#FFD700',
};

export const AVATAR_COLORS = [
  '#FF6B6B', '#2EC4B6', '#F4A261', '#C77DFF',
  '#00F5D4', '#64B5F6', '#FF66B2', '#FFD700',
  '#66FF99', '#E63946', '#A7A9BE', '#FF9F43',
];
