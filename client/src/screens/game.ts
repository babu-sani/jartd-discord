import { Colors, CategoryBg, CategoryAccent } from '../theme';
import { navigateTo } from '../router';
import { getChannelId } from '../discord';
import { getEngine, getIsHost } from './lobby';
import {
  emitCardDraw, emitAnswerReveal, emitRulesUpdate, emitGameEnd,
  onCardUpdate, onAnswerRevealed, onRulesUpdate, onGameEnded, onHostChanged,
} from '../socket';
import type { ActiveRule } from '../engine/types';

export function renderGame(container: HTMLElement) {
  const engine = getEngine();
  const amHost = getIsHost();
  const channelId = getChannelId()!;

  container.style.cssText = 'display:flex;flex-direction:column;min-height:100vh;padding:0;';

  // Top bar
  const topBar = document.createElement('div');
  topBar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:12px 16px;';
  container.appendChild(topBar);

  const endBtn = document.createElement('button');
  endBtn.textContent = 'End';
  endBtn.style.cssText = `background:none;color:${Colors.deep_red};font-family:'DM Sans',sans-serif;font-size:15px;font-weight:500;visibility:${amHost ? 'visible' : 'hidden'};`;
  endBtn.onclick = () => {
    if (!amHost) return;
    if (confirm('End the game?')) {
      emitGameEnd(channelId, engine?.getRound() || 0);
      navigateTo('lobby');
    }
  };
  topBar.appendChild(endBtn);

  const roundLabel = document.createElement('span');
  roundLabel.style.cssText = `font-family:'Outfit',sans-serif;font-size:15px;color:${Colors.muted_lavender};`;
  topBar.appendChild(roundLabel);

  const rulesBtn = document.createElement('button');
  rulesBtn.style.cssText = `background:${Colors.soft_purple};color:${Colors.clean_white};font-family:'Outfit',sans-serif;font-size:11px;font-weight:700;padding:5px 10px;border-radius:7px;display:none;`;
  topBar.appendChild(rulesBtn);

  // Card area
  const cardArea = document.createElement('div');
  cardArea.style.cssText = 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;user-select:none;';
  container.appendChild(cardArea);

  let answerRevealed = false;
  let gameOver = false;
  let currentRules: ActiveRule[] = [];

  function renderCard(drawnCard: any) {
    answerRevealed = false;
    const bg = CategoryBg[drawnCard.prompt.category as keyof typeof CategoryBg] || Colors.deep_charcoal;
    const accent = CategoryAccent[drawnCard.prompt.category as keyof typeof CategoryAccent] || Colors.teal_surge;

    cardArea.innerHTML = '';
    cardArea.className = 'card-enter';
    cardArea.style.background = bg;
    cardArea.style.padding = '32px 24px';

    const inner = document.createElement('div');
    inner.style.cssText = 'max-width:480px;width:100%;margin:0 auto;';
    cardArea.appendChild(inner);

    // Category label
    const catLabel = document.createElement('div');
    catLabel.textContent = drawnCard.isRuleEnd ? 'RULE OVER' : (drawnCard.prompt.category as string).toUpperCase();
    catLabel.style.cssText = `font-family:'Outfit',sans-serif;font-size:11px;font-weight:700;color:${accent};letter-spacing:2px;margin-bottom:16px;`;
    inner.appendChild(catLabel);

    // Prompt text
    const text = document.createElement('p');
    text.textContent = drawnCard.resolved.text;
    text.style.cssText = `font-family:'SourGummy','DM Sans',sans-serif;font-size:20px;color:${Colors.clean_white};line-height:1.5;text-align:center;`;
    inner.appendChild(text);

    // Answer section
    let answerDiv: HTMLElement | null = null;
    if (drawnCard.prompt.answer && !drawnCard.isRuleEnd) {
      answerDiv = document.createElement('div');
      answerDiv.style.cssText = 'margin-top:20px;opacity:0;transition:opacity 0.3s;';
      answerDiv.innerHTML = `
        <p style="font-size:11px;color:${Colors.muted_lavender};letter-spacing:1px;font-family:'Outfit',sans-serif;margin-bottom:6px;">ANSWER</p>
        <p style="font-size:16px;color:${accent};font-family:'Outfit',sans-serif;font-weight:600;">${drawnCard.prompt.answer}</p>
      `;
      inner.appendChild(answerDiv);
    }

    // Hint
    const hint = document.createElement('p');
    hint.style.cssText = `margin-top:20px;font-size:12px;color:${Colors.warm_gray};`;
    if (amHost) {
      hint.textContent = drawnCard.prompt.answer && !drawnCard.isRuleEnd ? 'Tap to reveal answer' : 'Tap for next card';
    } else {
      hint.textContent = 'Host controls the cards';
    }
    inner.appendChild(hint);

    // Host click handler
    if (amHost) {
      cardArea.onclick = () => {
        if (gameOver) return;
        if (drawnCard.prompt.answer && !drawnCard.isRuleEnd && !answerRevealed) {
          answerRevealed = true;
          if (answerDiv) answerDiv.style.opacity = '1';
          hint.textContent = 'Tap for next card';
          emitAnswerReveal(channelId);
        } else {
          drawNext();
        }
      };
    } else {
      cardArea.onclick = null;
    }
  }

  function drawNext() {
    if (!engine || gameOver) return;
    const card = engine.drawCard();
    if (!card) {
      gameOver = true;
      emitGameEnd(channelId, engine.getRound());
      renderEndState(engine.getRound());
      return;
    }

    renderCard(card);
    roundLabel.textContent = `Round ${engine.getRound()}`;

    // Sync to participants
    emitCardDraw(channelId, card);

    // Sync rules
    const rules = engine.getActiveRules();
    if (JSON.stringify(rules) !== JSON.stringify(currentRules)) {
      currentRules = rules;
      emitRulesUpdate(channelId, rules);
    }
    updateRulesBtn(rules);
  }

  function updateRulesBtn(rules: ActiveRule[]) {
    if (rules.length > 0) {
      rulesBtn.style.display = 'block';
      rulesBtn.textContent = `${rules.length} Rule${rules.length > 1 ? 's' : ''}`;
      rulesBtn.onclick = () => showRulesModal(rules);
    } else {
      rulesBtn.style.display = 'none';
    }
  }

  function renderEndState(totalRounds: number) {
    cardArea.innerHTML = '';
    cardArea.style.background = Colors.deep_charcoal;
    cardArea.style.padding = '40px 24px';
    cardArea.onclick = null;

    cardArea.innerHTML = `
      <h2 style="font-family:'Outfit',sans-serif;font-size:24px;color:${Colors.amber_gold};margin-bottom:10px;">That's All!</h2>
      <p style="font-size:15px;color:${Colors.muted_lavender};margin-bottom:28px;">${totalRounds} rounds played</p>
    `;

    const playAgain = document.createElement('button');
    playAgain.textContent = 'PLAY AGAIN';
    playAgain.style.cssText = `background:${Colors.teal_surge};color:${Colors.midnight_navy};font-size:15px;font-weight:700;padding:14px 36px;border-radius:12px;letter-spacing:1px;`;
    playAgain.onclick = () => navigateTo('lobby');
    cardArea.appendChild(playAgain);
  }

  // ── Socket listeners (participant path) ─────────────────────────────────
  onCardUpdate(({ drawnCard }) => {
    renderCard(drawnCard);
    roundLabel.textContent = `Round ${drawnCard.resolved?.ruleTurns || ''}`;
  });

  onAnswerRevealed(() => {
    const answerDiv = cardArea.querySelector('[style*="opacity:0"]') as HTMLElement;
    if (answerDiv) answerDiv.style.opacity = '1';
  });

  onRulesUpdate(({ activeRules }) => {
    currentRules = activeRules;
    updateRulesBtn(activeRules);
  });

  onGameEnded(({ totalRounds }) => {
    gameOver = true;
    renderEndState(totalRounds);
  });

  onHostChanged(() => {
    // Refresh — new host will be checked from lobby state
    navigateTo('lobby');
  });

  // ── Host: draw first card ───────────────────────────────────────────────
  if (amHost && engine) {
    drawNext();
  } else {
    // Participant: show waiting
    cardArea.innerHTML = `
      <p style="font-family:'Outfit',sans-serif;font-size:18px;color:${Colors.muted_lavender};">Waiting for first card...</p>
    `;
  }
}

function showRulesModal(rules: ActiveRule[]) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:100;padding:20px;`;
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

  const modal = document.createElement('div');
  modal.style.cssText = `background:${Colors.deep_charcoal};border-radius:14px;padding:20px;width:100%;max-width:380px;max-height:60vh;overflow-y:auto;`;
  modal.innerHTML = `<h3 style="font-family:'Outfit',sans-serif;font-size:16px;color:${Colors.soft_purple};margin-bottom:14px;">Active Rules</h3>`;

  rules.forEach(rule => {
    const item = document.createElement('div');
    item.style.cssText = `padding:10px;background:${Colors.midnight_navy};border-radius:8px;margin-bottom:6px;`;
    item.innerHTML = `
      <p style="font-size:13px;color:${Colors.clean_white};line-height:1.4;">${rule.text}</p>
      <p style="font-size:11px;color:${Colors.muted_lavender};margin-top:4px;">${rule.rounds_remaining} round${rule.rounds_remaining !== 1 ? 's' : ''} left</p>
    `;
    modal.appendChild(item);
  });

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'CLOSE';
  closeBtn.style.cssText = `width:100%;padding:12px;background:${Colors.warm_gray};color:${Colors.clean_white};border-radius:10px;font-size:13px;font-weight:700;margin-top:10px;`;
  closeBtn.onclick = () => overlay.remove();
  modal.appendChild(closeBtn);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}
