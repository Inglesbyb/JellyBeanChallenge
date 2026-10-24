// Haptics abstraction. Uses the Vibration API on the web / Android WebView.
// When wrapped with Capacitor, swap `buzz` for @capacitor/haptics (impact / notification).
const state = { enabled: true, last: 0 };

function buzz(pattern, minGap = 0) {
  if (!state.enabled) return;
  const now = performance.now();
  if (now - state.last < minGap) return;
  state.last = now;
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch { /* unsupported */ }
}

const rawHaptics = {
  light: () => buzz(8, 60),
  medium: () => buzz(18, 60),
  heavy: () => buzz([28, 18, 36]),
  success: () => buzz([14, 40, 14, 40, 30]),
  fail: () => buzz([60, 40, 140]),
  setEnabled: (v) => { state.enabled = v; },
};

export const haptics = new Proxy(rawHaptics, {
  get(target, prop) {
    if (prop in target) return target[prop];
    return () => {};
  }
});

