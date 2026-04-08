import { DiscordSDK } from '@discord/embedded-app-sdk';

const DISCORD_CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID as string;

let discordSdk: DiscordSDK;
let currentUser: { id: string; username: string; avatar: string | null } | null = null;
let channelId: string | null = null;

export async function initDiscord(): Promise<void> {
  discordSdk = new DiscordSDK(DISCORD_CLIENT_ID);
  await discordSdk.ready();

  // Step 1: Authorize
  const { code } = await discordSdk.commands.authorize({
    client_id: DISCORD_CLIENT_ID,
    response_type: 'code',
    state: '',
    prompt: 'none',
    scope: ['identify', 'rpc.activities.write'],
  });

  // Step 2: Exchange code for token via our server
  const res = await fetch('/.proxy/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text.substring(0, 100)}`);
  }
  const { access_token } = await res.json();

  // Step 3: Authenticate
  const auth = await discordSdk.commands.authenticate({ access_token });
  if (auth.user) {
    currentUser = {
      id: auth.user.id,
      username: auth.user.global_name || auth.user.username,
      avatar: auth.user.avatar,
    };
  }

  channelId = discordSdk.channelId;
}

export function getCurrentUser() {
  return currentUser;
}

export function getChannelId() {
  return channelId;
}

export function subscribeToParticipants(callback: (participants: Array<{ id: string; username: string }>) => void) {
  discordSdk.subscribe('ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE', (event: any) => {
    const participants = (event.participants || []).map((p: any) => ({
      id: p.id || p.user_id,
      username: p.global_name || p.username || 'Player',
    }));
    callback(participants);
  });
}
