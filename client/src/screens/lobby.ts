import { Colors, AVATAR_COLORS } from '../theme';
import { navigateTo } from '../router';
import { getCurrentUser, getChannelId } from '../discord';
import { loadSettings, saveSettings, DISCORD_FREE_PACKS, PACK_THUMBS } from '../store';
import { onPlayersUpdate, onGameStarted, emitGameStart } from '../socket';
import { GameEngine } from '../engine/GameEngine';
import type { GameSettings, GameMode, PackData } from '../engine/types';

interface PackManifestEntry {
  pack_id: string; title: string; description: string; prompt_count: number;
  is_free: boolean; enabled: boolean;
}

// Shared state for game screen
let currentEngine: GameEngine | null = null;
let isHost = false;

export function getEngine() { return currentEngine; }
export function getIsHost() { return isHost; }
export function setIsHost(v: boolean) { isHost = v; }

export function renderLobby(container: HTMLElement) {
  const user = getCurrentUser();
  let settings = loadSettings();
  let players: Array<{ userId: string; username: string }> = [];
  let hostId = '';
  let manifest: PackManifestEntry[] = [];

  container.style.cssText = 'display:flex;flex-direction:column;min-height:100vh;padding:16px 0;';

  // Header
  const header = document.createElement('div');
  header.style.cssText = 'text-align:center;margin-bottom:20px;';
  header.innerHTML = `
    <h1 style="font-family:'Outfit',sans-serif;font-size:32px;font-weight:800;color:${Colors.electric_coral};letter-spacing:4px;">JARTD</h1>
    <p style="font-size:14px;color:${Colors.muted_lavender};margin-top:4px;">The Party Card Game</p>
  `;
  container.appendChild(header);

  const scroll = document.createElement('div');
  scroll.style.cssText = 'flex:1;overflow-y:auto;padding-bottom:90px;';
  container.appendChild(scroll);

  // ── Players ─────────────────────────────────────────────────────────────
  scroll.innerHTML += `<h3 style="font-family:'Outfit',sans-serif;font-size:14px;color:${Colors.amber_gold};letter-spacing:1px;margin-bottom:10px;">PLAYERS</h3>`;
  const playerList = document.createElement('div');
  playerList.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px;';
  scroll.appendChild(playerList);

  function renderPlayers() {
    playerList.innerHTML = '';
    players.forEach((p, i) => {
      const isPlayerHost = p.userId === hostId;
      const chip = document.createElement('div');
      chip.style.cssText = `display:flex;align-items:center;gap:6px;background:${AVATAR_COLORS[i % AVATAR_COLORS.length]}22;border:1px solid ${AVATAR_COLORS[i % AVATAR_COLORS.length]};border-radius:20px;padding:6px 12px;`;
      chip.innerHTML = `
        <span style="color:${Colors.clean_white};font-size:13px;">${p.username}</span>
        ${isPlayerHost ? `<span style="font-size:10px;color:${Colors.amber_gold};font-family:'Outfit',sans-serif;font-weight:700;">HOST</span>` : ''}
      `;
      playerList.appendChild(chip);
    });
    if (players.length === 0) {
      playerList.innerHTML = `<p style="font-size:13px;color:${Colors.warm_gray};">Waiting for players...</p>`;
    }
  }

  // ── Game Mode ───────────────────────────────────────────────────────────
  const modeSection = document.createElement('div');
  modeSection.style.marginBottom = '20px';
  modeSection.innerHTML = `<h3 style="font-family:'Outfit',sans-serif;font-size:14px;color:${Colors.amber_gold};letter-spacing:1px;margin-bottom:10px;">GAME MODE</h3>`;
  scroll.appendChild(modeSection);

  const modeRow = document.createElement('div');
  modeRow.style.cssText = 'display:flex;gap:8px;margin-bottom:6px;';
  modeSection.appendChild(modeRow);

  const modeHint = document.createElement('p');
  modeHint.style.cssText = `font-size:12px;color:${Colors.muted_lavender};`;
  modeSection.appendChild(modeHint);

  function renderMode() {
    modeRow.innerHTML = '';
    (['party', 'drinks'] as GameMode[]).forEach(mode => {
      const btn = document.createElement('button');
      const active = settings.game_mode === mode;
      const color = mode === 'party' ? Colors.soft_purple : Colors.teal_surge;
      btn.textContent = mode === 'party' ? 'Party' : 'Drinks';
      btn.style.cssText = `flex:1;padding:12px;border-radius:10px;font-size:13px;font-weight:700;letter-spacing:1px;border:1px solid ${active ? color : Colors.warm_gray};background:${active ? color : Colors.deep_charcoal};color:${active ? Colors.midnight_navy : Colors.muted_lavender};`;
      btn.disabled = !isHost;
      btn.style.opacity = isHost ? '1' : '0.6';
      btn.onclick = () => { if (!isHost) return; settings = { ...settings, game_mode: mode }; saveSettings(settings); renderMode(); };
      modeRow.appendChild(btn);
    });
    modeHint.textContent = settings.game_mode === 'party' ? 'No drinking \u2014 points and dares' : 'Classic mode with sips and drinks';
  }

  // ── Intensity ───────────────────────────────────────────────────────────
  const intensitySection = document.createElement('div');
  intensitySection.style.marginBottom = '20px';
  intensitySection.innerHTML = `<h3 style="font-family:'Outfit',sans-serif;font-size:14px;color:${Colors.amber_gold};letter-spacing:1px;margin-bottom:10px;">INTENSITY</h3>`;
  scroll.appendChild(intensitySection);

  const intensityRow = document.createElement('div');
  intensityRow.style.cssText = 'display:flex;gap:6px;';
  intensitySection.appendChild(intensityRow);

  function renderIntensity() {
    intensityRow.innerHTML = '';
    (['chill', 'normal', 'wild', 'chaos'] as const).forEach(level => {
      const btn = document.createElement('button');
      const active = settings.intensity === level;
      btn.textContent = level.charAt(0).toUpperCase() + level.slice(1);
      btn.style.cssText = `flex:1;padding:10px 2px;border-radius:10px;font-size:12px;font-weight:600;border:1px solid ${active ? Colors.teal_surge : Colors.warm_gray};background:${active ? Colors.teal_surge : Colors.deep_charcoal};color:${active ? Colors.midnight_navy : Colors.muted_lavender};`;
      btn.disabled = !isHost;
      btn.style.opacity = isHost ? '1' : '0.6';
      btn.onclick = () => { if (!isHost) return; settings = { ...settings, intensity: level }; saveSettings(settings); renderIntensity(); };
      intensityRow.appendChild(btn);
    });
  }

  // ── Packs ───────────────────────────────────────────────────────────────
  const packsSection = document.createElement('div');
  packsSection.innerHTML = `<h3 style="font-family:'Outfit',sans-serif;font-size:14px;color:${Colors.amber_gold};letter-spacing:1px;margin-bottom:10px;">PACKS</h3>`;
  scroll.appendChild(packsSection);

  const packsList = document.createElement('div');
  packsList.style.cssText = 'display:flex;flex-direction:column;gap:8px;';
  packsSection.appendChild(packsList);

  function renderPacks() {
    packsList.innerHTML = '';
    manifest.filter(p => p.enabled).forEach(pack => {
      const isFree = DISCORD_FREE_PACKS.has(pack.pack_id);
      const isSelected = settings.selected_packs.includes(pack.pack_id);
      const thumb = PACK_THUMBS[pack.pack_id];
      const card = document.createElement('div');
      card.style.cssText = `display:flex;align-items:center;padding:10px;background:${Colors.deep_charcoal};border-radius:10px;border:2px solid ${isSelected ? Colors.teal_surge : 'transparent'};cursor:${isHost && isFree ? 'pointer' : 'default'};opacity:${isFree ? '1' : '0.5'};`;
      card.innerHTML = `
        <img src="${thumb || ''}" style="width:36px;height:36px;border-radius:8px;object-fit:cover;margin-right:10px;background:${Colors.warm_gray};" onerror="this.style.display='none'">
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="font-family:'Outfit',sans-serif;font-size:13px;color:${Colors.clean_white};">${pack.title}</span>
            ${!isFree ? `<span style="font-size:9px;color:${Colors.amber_gold};font-family:'Outfit',sans-serif;background:rgba(244,162,97,0.2);padding:1px 5px;border-radius:3px;letter-spacing:1px;">APP ONLY</span>` : ''}
          </div>
          <span style="font-size:11px;color:${Colors.warm_gray};">${pack.prompt_count} prompts</span>
        </div>
        ${isFree ? `
          <div style="width:20px;height:20px;border-radius:10px;border:2px solid ${isSelected ? Colors.teal_surge : Colors.warm_gray};background:${isSelected ? Colors.teal_surge : 'transparent'};display:flex;align-items:center;justify-content:center;">
            ${isSelected ? `<span style="color:${Colors.midnight_navy};font-size:12px;font-weight:700;">\u2713</span>` : ''}
          </div>
        ` : ''}
      `;
      if (isHost && isFree) {
        card.onclick = () => {
          if (isSelected) {
            if (settings.selected_packs.length <= 1) return;
            settings.selected_packs = settings.selected_packs.filter(p => p !== pack.pack_id);
          } else {
            settings.selected_packs = [...settings.selected_packs, pack.pack_id];
          }
          saveSettings(settings); renderPacks(); updateStartBtn();
        };
      }
      packsList.appendChild(card);
    });
  }

  fetch('./data/packs_manifest.json')
    .then(r => r.json())
    .then((data: { packs: PackManifestEntry[] }) => { manifest = data.packs; renderPacks(); });

  // ── Start Button / Waiting Message ──────────────────────────────────────
  const bottomBar = document.createElement('div');
  bottomBar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;padding:12px 16px;background:linear-gradient(transparent, #0F0E17 30%);display:flex;justify-content:center;';
  container.appendChild(bottomBar);

  const startBtn = document.createElement('button');
  startBtn.style.cssText = `width:100%;max-width:480px;padding:16px;border-radius:14px;font-size:16px;font-weight:700;letter-spacing:2px;background:${Colors.teal_surge};color:${Colors.midnight_navy};`;
  bottomBar.appendChild(startBtn);

  function updateStartBtn() {
    if (isHost) {
      const valid = players.length >= 2 && settings.selected_packs.length >= 1;
      startBtn.textContent = "LET'S GO";
      startBtn.style.opacity = valid ? '1' : '0.4';
      startBtn.style.pointerEvents = valid ? 'auto' : 'none';
      startBtn.style.background = Colors.teal_surge;
    } else {
      startBtn.textContent = 'Waiting for host...';
      startBtn.style.opacity = '0.5';
      startBtn.style.pointerEvents = 'none';
      startBtn.style.background = Colors.warm_gray;
    }
  }

  startBtn.onclick = async () => {
    if (!isHost) return;
    startBtn.textContent = 'LOADING...';
    startBtn.style.pointerEvents = 'none';

    const playerNames = players.map(p => p.username);
    const packDataArr: PackData[] = [];
    for (const packId of settings.selected_packs) {
      const data = await fetch(`./data/${packId}.json`).then(r => r.json());
      packDataArr.push(data as PackData);
    }

    currentEngine = new GameEngine(packDataArr, playerNames, settings);
    emitGameStart(getChannelId()!, settings, playerNames);
    navigateTo('game');
  };

  // ── Socket listeners ────────────────────────────────────────────────────
  onPlayersUpdate((data) => {
    players = data.players;
    hostId = data.hostId;
    isHost = user?.id === hostId;
    renderPlayers();
    renderMode();
    renderIntensity();
    renderPacks();
    updateStartBtn();
  });

  onGameStarted(({ settings: s, playerNames }) => {
    if (!isHost) {
      // Participant: just navigate to game (host already navigated)
      navigateTo('game');
    }
  });

  // Initial render
  renderPlayers();
  renderMode();
  renderIntensity();
  updateStartBtn();
}
