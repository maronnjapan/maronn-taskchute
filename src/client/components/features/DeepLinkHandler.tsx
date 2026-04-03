import { useRef } from 'react';
import { useDeepLink } from '../../hooks/use-deep-link';

/**
 * Initializes the deep link listener for mobile auth callback.
 * Uses a ref to ensure the listener is only added once.
 */
export function DeepLinkHandler() {
  const { initDeepLinkListener } = useDeepLink();
  const initialized = useRef(false);

  if (!initialized.current) {
    initialized.current = true;
    void initDeepLinkListener();
  }

  return null;
}
