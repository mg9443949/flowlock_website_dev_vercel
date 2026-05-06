const { app, Tray, Menu, nativeImage, shell } = require('electron');
const path = require('path');
const { initSupabase, handleAuthCallback, hasStoredSession, signOut, checkActiveSession, setupRealtimeWatcher } = require('./supabase');
const { fetchVaultItems, enforcVault } = require('./vault');

const FLOWLOCK_URL = "http://localhost:3000"; // Can swap to production domain here

let isBlocking = false;
let tray = null;
let pollInterval = null;

// Deep Linking Setup
// Register 'flowlock://' custom protocol
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('flowlock', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('flowlock');
}

// Single instance lock to prevent multiple background agents
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  // Catch deep link on Windows / Linux when app is already running
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // URL usually comes as the last argument
    const url = commandLine.pop();
    handleDeepLink(url);
  });
}

// macOS deep link handler
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

async function handleDeepLink(url) {
  if (!url || !url.startsWith('flowlock://auth')) return;
  
  const urlObj = new URL(url);
  const accessToken = urlObj.searchParams.get('access_token');
  const refreshToken = urlObj.searchParams.get('refresh_token');

  if (accessToken && refreshToken) {
    updateTrayStatus("FlowLock Agent — Authenticating...");
    const { error } = await handleAuthCallback(accessToken, refreshToken);
    
    if (error) {
      updateTrayStatus("FlowLock Agent — Auth Failed");
      console.error("Auth callback error:", error);
    } else {
      updateTrayStatus("FlowLock Agent — Connected");
      syncAndEnforce();
      await setupRealtimeWatcher(syncAndEnforce);
    }
  }
}

function updateTrayStatus(statusText) {
  if (tray) {
    tray.setToolTip(statusText);
    const contextMenu = Menu.buildFromTemplate([
      { label: `Status: ${statusText.replace('FlowLock Agent — ', '')}`, enabled: false },
      { type: 'separator' },
      {
        label: isBlocking ? 'Stop Blocking' : 'Start Blocking',
        click: async () => {
          isBlocking = !isBlocking;
          if (isBlocking) {
            const appsToBlock = await fetchVaultItems();
            await enforcVault(appsToBlock);
            updateTrayStatus(`FlowLock — Blocking ${appsToBlock.length} apps`);
          } else {
            updateTrayStatus('FlowLock — Idle');
          }
        }
      },
      {
        label: 'Sign Out',
        click: async () => {
          await signOut();
          updateTrayStatus("FlowLock Agent — Needs Login");
          // Clear active polling on sign out
          if (pollInterval) {
             clearInterval(pollInterval);
             pollInterval = null;
          }
        }
      },
      { type: 'separator' },
      { label: 'Quit FlowLock Agent', role: 'quit' }
    ]);
    tray.setContextMenu(contextMenu);
  }
}

async function syncAndEnforce() {
  const hasSession = await hasStoredSession();
  if (!hasSession) {
    updateTrayStatus("FlowLock Agent — Needs Login");
    return;
  }

  const isActive = await checkActiveSession();

  if (isActive) {
    const appsToBlock = await fetchVaultItems();
    updateTrayStatus(`FlowLock — Session Active | ${appsToBlock.length} apps blocked`);
    await enforcVault(appsToBlock);
  } else {
    updateTrayStatus("FlowLock — Idle");
  }
}

// Main execution block
app.whenReady().then(async () => {
  // Headless: don't show dock icon on macOS
  if (app.dock) app.dock.hide();
  
  // Create an empty (transparent) 16x16 icon natively if no actual icon exists yet
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  updateTrayStatus("FlowLock Agent — Starting up...");

  // We MUST initialize Supabase AFTER app.whenReady() so safeStorage is available
  await initSupabase();

  const hasSession = await hasStoredSession();
  
  if (!hasSession) {
    // Open default browser for auth callback because we don't have stored keys
    updateTrayStatus("FlowLock Agent — Awaiting Login");
    shell.openExternal(`${FLOWLOCK_URL}/auth/desktop-callback`);
  } else {
    // Perform the first sync right away if logged in
    syncAndEnforce();
    await setupRealtimeWatcher(syncAndEnforce);
  }

  // Poll every 30 seconds

  pollInterval = setInterval(() => {
    syncAndEnforce();
  }, 10 * 1000);
});

// App should remain active running in system tray
app.on('window-all-closed', () => {
  // Prevent quitting when no windows are open, as it's a tray app
});
