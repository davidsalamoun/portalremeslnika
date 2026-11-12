/**
 * Haptic feedback utility for mobile devices on building sites
 */
export function triggerHaptic(
  type: 'light' | 'medium' | 'success' | 'warning' | 'selection' | 'impact' | 'error' = 'light'
) {
  if (typeof window === 'undefined' || !window.navigator || !window.navigator.vibrate) {
    return;
  }

  try {
    switch (type) {
      case 'selection':
      case 'light':
        window.navigator.vibrate(12);
        break;
      case 'medium':
      case 'impact':
        window.navigator.vibrate(30);
        break;
      case 'success':
        window.navigator.vibrate([25, 40, 35]);
        break;
      case 'warning':
      case 'error':
        window.navigator.vibrate([40, 60, 40]);
        break;
      default:
        window.navigator.vibrate(12);
    }
  } catch {
    // Ignore unsupported environments
  }
}
