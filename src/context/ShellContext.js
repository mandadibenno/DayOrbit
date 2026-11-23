import { createContext, useContext } from 'react';

// UI-level actions shared across screens: open Quick Add / the space switcher, and a
// counter that screens watch to reload after something was added elsewhere.
export const ShellContext = createContext({ openQuickAdd: () => {}, openSwitcher: () => {}, dataVersion: 0, bump: () => {} });
export const useShell = () => useContext(ShellContext);
