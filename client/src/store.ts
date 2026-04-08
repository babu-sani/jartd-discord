import type { GameSettings } from './engine/types';
import { DEFAULT_SETTINGS } from './engine/types';

export const DISCORD_FREE_PACKS = new Set(['jartd_base_game', 'globe_trotters', 'unhinged']);

export const PACK_THUMBS: Record<string, string> = {
  jartd_base_game: '/packs/pack_thumb_base.png',
  globe_trotters: '/packs/pack_thumb_globaltrotter.png',
  against_the_bar: '/packs/pack_thumb_againstthebar.png',
  unhinged: '/packs/pack_thumb_unhinged.png',
  video_games: '/packs/pack_thumb_videogames.png',
  music: '/packs/pack_thumb_music.png',
  animated_movies: '/packs/pack_thumb_animatedmovies.png',
  movies: '/packs/pack_thumb_movies.png',
  tv_shows: '/packs/pack_thumb_tv.png',
  sitcoms: '/packs/pack_thumb_sitcom.png',
  sports: '/packs/pack_thumb_sports.png',
  marine_life: '/packs/pack_thumb_marinelife.png',
  nature: '/packs/pack_thumb_nature.png',
  wedding: '/packs/pack_thumb_wedding.png',
  bachelorette: '/packs/pack_thumb_bachelorette.png',
  bachelor: '/packs/pack_thumb_bachelor.png',
};

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem('jartd_discord_settings');
    return raw ? JSON.parse(raw) : DEFAULT_SETTINGS;
  } catch { return DEFAULT_SETTINGS; }
}

export function saveSettings(s: GameSettings) {
  localStorage.setItem('jartd_discord_settings', JSON.stringify(s));
}
