// File: src/navigation/nav.js
import { createNavigationContainerRef } from '@react-navigation/native';

export const navRef = createNavigationContainerRef();

export function go(name, params) {
  if (navRef.isReady()) {
    navRef.navigate(name, params);
  }
}
