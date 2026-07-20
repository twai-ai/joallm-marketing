import { useEffect, useState } from 'react';

export type KeyboardShortcut = {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean; // Cmd on Mac, Windows key on Windows
  description: string;
  action: () => void;
  category: 'navigation' | 'chat' | 'general' | 'view';
};

const shortcuts: KeyboardShortcut[] = [
  // Navigation
  { key: 'k', ctrl: true, description: 'Open command palette', action: () => {}, category: 'navigation' },
  { key: 'n', ctrl: true, description: 'New chat', action: () => {}, category: 'chat' },
  { key: '/', ctrl: true, description: 'Toggle sidebar', action: () => {}, category: 'navigation' },
  { key: 'd', ctrl: true, description: 'Toggle documentation', action: () => {}, category: 'navigation' },

  // Chat
  { key: 'Enter', ctrl: true, description: 'Send message', action: () => {}, category: 'chat' },
  { key: 'e', ctrl: true, shift: true, description: 'Export chat', action: () => {}, category: 'chat' },
  { key: 'h', ctrl: true, description: 'Toggle chat history', action: () => {}, category: 'chat' },

  // General
  { key: 's', ctrl: true, description: 'Open settings', action: () => {}, category: 'general' },
  { key: 'Escape', description: 'Close modal/dialog', action: () => {}, category: 'general' },

  // View
  { key: '1', ctrl: true, description: 'Switch to chat', action: () => {}, category: 'view' },
  { key: '2', ctrl: true, description: 'Switch to notebook', action: () => {}, category: 'view' },
  { key: '3', ctrl: true, description: 'Switch to workflow', action: () => {}, category: 'view' },
  { key: '4', ctrl: true, description: 'Switch to docs', action: () => {}, category: 'view' },
];

export function useKeyboardShortcuts() {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.key) return; // Skip if key is undefined
      
      setPressedKeys(prev => new Set(prev).add(event.key));

      // Check for shortcuts
      for (const shortcut of shortcuts) {
        const matches = checkShortcut(event, shortcut);

        if (matches) {
          event.preventDefault();
          shortcut.action();
          break;
        }
      }

      // Special handling for command palette
      if (event.ctrlKey && event.key === 'k') {
        event.preventDefault();
        setIsCommandPaletteOpen(true);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (!event.key) return; // Skip if key is undefined
      
      setPressedKeys(prev => {
        const next = new Set(prev);
        next.delete(event.key);
        return next;
      });
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const checkShortcut = (event: KeyboardEvent, shortcut: KeyboardShortcut): boolean => {
    if (!event.key || !shortcut.key) return false;
    if (event.key.toLowerCase() !== shortcut.key.toLowerCase()) return false;

    if (shortcut.ctrl && !event.ctrlKey) return false;
    if (shortcut.shift && !event.shiftKey) return false;
    if (shortcut.alt && !event.altKey) return false;
    if (shortcut.meta && !event.metaKey) return false;

    // If no modifiers required, ensure no modifiers are pressed
    if (!shortcut.ctrl && !shortcut.shift && !shortcut.alt && !shortcut.meta) {
      if (event.ctrlKey || event.shiftKey || event.altKey || event.metaKey) return false;
    }

    return true;
  };

  return {
    shortcuts,
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    pressedKeys: Array.from(pressedKeys),
  };
}


