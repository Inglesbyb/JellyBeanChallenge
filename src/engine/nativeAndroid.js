// Native Android Capacitor Bridge (TICKET-06 & TICKET-07)
// Handles hardware back button navigation, exit behavior, and immersive edge-to-edge system bars.

import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';

export function setupNativeAndroidBridge(reel) {
  // 1. Hardware Back Button Navigation
  try {
    App.addListener('backButton', () => {
      handleAndroidBack(reel);
    });
  } catch (err) {
    // Non-native / Web browser fallback - App listener is a no-op
    console.log('[NativeBridge] Running in web browser context');
  }

  // 2. Immersive System Status Bar
  setupNativeStatusBar();
}

export async function setupNativeStatusBar() {
  try {
    // Enable edge-to-edge transparent overlay for full-screen arcade immersion
    await StatusBar.setOverlaysWebView({ overlay: true });
    // Dark mode icons (light text on dark background)
    await StatusBar.setStyle({ style: Style.Dark });
    // Match root background color
    await StatusBar.setBackgroundColor({ color: '#05050c' });
  } catch (err) {
    // Silently continue in web environments where native status bar is unavailable
  }
}

export function handleAndroidBack(reel) {
  const $ = (s) => document.querySelector(s);

  // 1. Share Card Preview Modal
  const shareModal = $('#shareModal');
  if (shareModal && !shareModal.classList.contains('hidden')) {
    reel.closeShareModal();
    return;
  }

  // 2. Captain's Closet Modal
  const closetModal = $('#closetModal');
  if (closetModal && !closetModal.classList.contains('hidden')) {
    reel.closeCloset();
    return;
  }

  // 3. Commander Dossier Profile Modal
  const profileModal = $('#profileModal');
  if (profileModal && !profileModal.classList.contains('hidden')) {
    reel.closeProfile();
    return;
  }

  // 4. Daily Gauntlet Summary Modal
  const dailySummary = $('#dailySummaryModal');
  if (dailySummary && !dailySummary.classList.contains('hidden')) {
    reel.closeDailySummary();
    return;
  }

  // 5. Settings / Pause Modal
  const settingsModal = $('#settingsModal');
  if (settingsModal && !settingsModal.classList.contains('hidden')) {
    reel.closeSettings();
    return;
  }

  // 6. Active Gameplay -> Tactical Pause (protect player's run)
  if (reel.mode === 'playing') {
    reel.pause();
    return;
  }

  // 7. Paused state -> Resume run
  if (reel.mode === 'paused') {
    reel.resume();
    return;
  }

  // 8. Main Menu -> Exit Native App cleanly
  if (reel.mode === 'menu') {
    try {
      App.exitApp();
    } catch (e) {
      // Browser fallback
    }
    return;
  }
}
