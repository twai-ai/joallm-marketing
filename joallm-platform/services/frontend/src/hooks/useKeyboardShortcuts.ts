import { useEffect, useState, useCallback } from 'react';

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

export interface ShortcutActions {
  onToggleSidebar?: () => void;
  onOpenSettings?: () => void;
  onToggleCommandPalette?: () => void;
  onNewChat?: () => void;
  onSwitchView?: (view: string) => void;
  onToggleDocumentation?: () => void;
  onToggleChatHistory?: () => void;
  onExportChat?: () => void;
  onSendMessage?: () => void;
  onCloseModal?: () => void;
}

export function useKeyboardShortcuts(actions: ShortcutActions = {}) {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());

  const createShortcuts = useCallback((): KeyboardShortcut[] => [
    // Navigation
    { 
      key: 'k', 
      ctrl: true, 
      description: 'Open command palette', 
      action: () => {
        setIsCommandPaletteOpen(true);
        actions.onToggleCommandPalette?.();
      }, 
      category: 'navigation' 
    },
    { 
      key: 'n', 
      ctrl: true, 
      description: 'New chat', 
      action: () => actions.onNewChat?.(), 
      category: 'chat' 
    },
    { 
      key: '/', 
      ctrl: true, 
      description: 'Toggle sidebar', 
      action: () => actions.onToggleSidebar?.(), 
      category: 'navigation' 
    },
    { 
      key: 'd', 
      ctrl: true, 
      description: 'Toggle documentation', 
      action: () => actions.onToggleDocumentation?.(), 
      category: 'navigation' 
    },

    // Chat
    { 
      key: 'Enter', 
      ctrl: true, 
      description: 'Send message', 
      action: () => actions.onSendMessage?.(), 
      category: 'chat' 
    },
    { 
      key: 'e', 
      ctrl: true, 
      shift: true, 
      description: 'Export chat', 
      action: () => actions.onExportChat?.(), 
      category: 'chat' 
    },
    { 
      key: 'h', 
      ctrl: true, 
      description: 'Toggle chat history', 
      action: () => actions.onToggleChatHistory?.(), 
      category: 'chat' 
    },

    // General
    { 
      key: 's', 
      ctrl: true, 
      description: 'Open settings', 
      action: () => actions.onOpenSettings?.(), 
      category: 'general' 
    },
    { 
      key: 'Escape', 
      description: 'Close modal/dialog', 
      action: () => actions.onCloseModal?.(), 
      category: 'general' 
    },

    // View
    { 
      key: '1', 
      ctrl: true, 
      description: 'Switch to chat', 
      action: () => actions.onSwitchView?.('chat'), 
      category: 'view' 
    },
    { 
      key: '2', 
      ctrl: true, 
      description: 'Switch to notebook', 
      action: () => actions.onSwitchView?.('notebook'), 
      category: 'view' 
    },
    { 
      key: '3', 
      ctrl: true, 
      description: 'Switch to workflow', 
      action: () => actions.onSwitchView?.('workflow'), 
      category: 'view' 
    },
    { 
      key: '4', 
      ctrl: true, 
      description: 'Switch to docs', 
      action: () => actions.onSwitchView?.('docs'), 
      category: 'view' 
    },
  ], [actions]);

  const shortcuts = createShortcuts();

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
  }, [shortcuts]);

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


