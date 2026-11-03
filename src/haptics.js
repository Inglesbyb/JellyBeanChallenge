// Native Android & Web Haptics Engine (TICKET-07)
// Integrates @capacitor/haptics for real native device actuator impacts (Taptic / Linear Resonant Actuator)
// with seamless fallback to the W3C Vibration API on web browsers.

import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { store } from './engine/store.js';

let lastHapticTime = 0;

function canTrigger(minGap = 40) {
  const isEnabled = store?.settings?.haptics ?? true;
  if (!isEnabled) return false;
  const now = performance.now();
  if (now - lastHapticTime < minGap) return false;
  lastHapticTime = now;
  return true;
}

function webVibrate(pattern) {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  } catch {
    // Unsupported / silent fallback
  }
}

const rawHaptics = {
  async light() {
    if (!canTrigger(40)) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      webVibrate(10);
    }
  },

  async medium() {
    if (!canTrigger(50)) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch {
      webVibrate(22);
    }
  },

  async heavy() {
    if (!canTrigger(60)) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch {
      webVibrate([30, 20, 40]);
    }
  },

  async success() {
    if (!canTrigger(80)) return;
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch {
      webVibrate([16, 40, 16, 40, 32]);
    }
  },

  async fail() {
    if (!canTrigger(80)) return;
    try {
      await Haptics.notification({ type: NotificationType.Error });
    } catch {
      webVibrate([70, 50, 150]);
    }
  },

  async selection() {
    if (!canTrigger(35)) return;
    try {
      await Haptics.selectionStart();
      await Haptics.selectionChanged();
      await Haptics.selectionEnd();
    } catch {
      webVibrate(8);
    }
  },

  setEnabled(val) {
    if (store?.settings) {
      store.settings.haptics = Boolean(val);
      store.save();
    }
  },
};

export const haptics = new Proxy(rawHaptics, {
  get(target, prop) {
    if (prop in target) return target[prop];
    return () => {};
  },
});
