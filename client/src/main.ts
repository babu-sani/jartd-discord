import './styles/global.css';
import './styles/animations.css';
import { initDiscord, getCurrentUser, getChannelId } from './discord';
import { connectSocket, joinRoom } from './socket';
import { registerScreen, navigateTo, initApp } from './router';
import { renderLobby } from './screens/lobby';
import { renderGame } from './screens/game';
import { Colors } from './theme';

async function bootstrap() {
  const app = document.getElementById('app')!;

  // Loading state
  app.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;">
      <h1 style="font-family:'Outfit',sans-serif;font-size:32px;font-weight:800;color:${Colors.electric_coral};letter-spacing:4px;margin-bottom:12px;">JARTD</h1>
      <p style="font-size:14px;color:${Colors.muted_lavender};">Connecting...</p>
    </div>
  `;

  try {
    // Step 1: Initialize Discord SDK + authenticate
    await initDiscord();
    const user = getCurrentUser();
    const channelId = getChannelId();

    if (!user || !channelId) {
      app.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;"><p style="color:${Colors.electric_coral};">Could not connect to Discord. Please try again.</p></div>`;
      return;
    }

    // Step 2: Connect Socket.io + join room
    connectSocket();
    joinRoom(channelId, user.id, user.username);

    // Step 3: Register screens and start
    initApp();
    registerScreen('lobby', renderLobby);
    registerScreen('game', renderGame);
    navigateTo('lobby');

  } catch (err: any) {
    console.error('[JARTD] Bootstrap error:', err);
    const errMsg = err?.message || err?.toString() || 'Unknown error';
    app.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:24px;text-align:center;">
        <h2 style="font-family:'Outfit',sans-serif;font-size:20px;color:${Colors.electric_coral};margin-bottom:12px;">Connection Error</h2>
        <p style="font-size:14px;color:${Colors.muted_lavender};margin-bottom:16px;">Could not connect to the game server. Please try launching the Activity again.</p>
        <p style="font-size:11px;color:${Colors.warm_gray};word-break:break-all;max-width:400px;">Debug: ${errMsg}</p>
      </div>
    `;
  }
}

bootstrap();
