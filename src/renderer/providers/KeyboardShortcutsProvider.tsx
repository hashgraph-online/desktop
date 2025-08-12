import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

interface Shortcut {
  id: string
  keys: string[]
  description: string
  handler: () => void
  category: 'navigation' | 'app' | 'chat' | 'editing' | 'system'
  global?: boolean
}

interface KeyboardShortcutsContextType {
  shortcuts: Shortcut[]
  registerShortcut: (shortcut: Shortcut) => void
  unregisterShortcut: (id: string) => void
  showShortcutsDialog: boolean
  setShowShortcutsDialog: (show: boolean) => void
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextType | null>(null)

export const useKeyboardShortcuts = () => {
  const context = useContext(KeyboardShortcutsContext)
  if (!context) {
    throw new Error('useKeyboardShortcuts must be used within KeyboardShortcutsProvider')
  }
  return context
}

interface KeyboardShortcutsProviderProps {
  children: React.ReactNode
}

export const KeyboardShortcutsProvider: React.FC<KeyboardShortcutsProviderProps> = ({ children }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([])
  const [showShortcutsDialog, setShowShortcutsDialog] = useState(false)
  const pressedKeys = useRef(new Set<string>())

  useEffect(() => {
    const defaultShortcuts: Shortcut[] = [
      {
        id: 'nav-home',
        keys: ['cmd+1', 'ctrl+1'],
        description: 'Go to Home',
        handler: () => navigate('/'),
        category: 'navigation',
        global: true
      },
      {
        id: 'nav-chat',
        keys: ['cmd+2', 'ctrl+2'],
        description: 'Go to Chat',
        handler: () => navigate('/chat'),
        category: 'navigation',
        global: true
      },
      {
        id: 'nav-mcp',
        keys: ['cmd+3', 'ctrl+3'],
        description: 'Go to MCP Servers',
        handler: () => navigate('/mcp'),
        category: 'navigation',
        global: true
      },
      {
        id: 'nav-plugins',
        keys: ['cmd+4', 'ctrl+4'],
        description: 'Go to Plugins',
        handler: () => navigate('/plugins'),
        category: 'navigation',
        global: true
      },
      {
        id: 'nav-settings',
        keys: ['cmd+,', 'ctrl+,'],
        description: 'Open Settings',
        handler: () => navigate('/settings'),
        category: 'navigation',
        global: true
      },
      
      {
        id: 'app-search',
        keys: ['cmd+k', 'ctrl+k'],
        description: 'Open Command Palette',
        handler: () => {
          window.dispatchEvent(new CustomEvent('open-command-palette'))
        },
        category: 'app',
        global: true
      },
      {
        id: 'app-sidebar',
        keys: ['cmd+b', 'ctrl+b'],
        description: 'Toggle Sidebar',
        handler: () => {
          window.dispatchEvent(new CustomEvent('toggle-sidebar'))
        },
        category: 'app',
        global: true
      },
      {
        id: 'app-shortcuts',
        keys: ['cmd+/', 'ctrl+/'],
        description: 'Show Keyboard Shortcuts',
        handler: () => setShowShortcutsDialog(true),
        category: 'app',
        global: true
      },
      {
        id: 'app-refresh',
        keys: ['cmd+r', 'ctrl+r'],
        description: 'Refresh',
        handler: () => window.location.reload(),
        category: 'app',
        global: true
      },
      
      {
        id: 'system-fullscreen',
        keys: ['f11'],
        description: 'Toggle Fullscreen',
        handler: () => {
          if (window.electron) {
            window.electron.invoke('toggle-fullscreen')
          }
        },
        category: 'system',
        global: true
      },
      {
        id: 'system-devtools',
        keys: ['cmd+alt+i', 'ctrl+shift+i'],
        description: 'Open Developer Tools',
        handler: () => {
          if (window.electron) {
            window.electron.invoke('toggle-devtools')
          }
        },
        category: 'system',
        global: true
      }
    ]

    setShortcuts(defaultShortcuts)
  }, [navigate])

  const registerShortcut = (shortcut: Shortcut) => {
    setShortcuts(prev => {
      const existing = prev.findIndex(s => s.id === shortcut.id)
      if (existing >= 0) {
        const updated = [...prev]
        updated[existing] = shortcut
        return updated
      }
      return [...prev, shortcut]
    })
  }

  const unregisterShortcut = (id: string) => {
    setShortcuts(prev => prev.filter(s => s.id !== id))
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      pressedKeys.current.add(e.key.toLowerCase())
      
      const modifiers = {
        cmd: e.metaKey,
        ctrl: e.ctrlKey,
        alt: e.altKey,
        shift: e.shiftKey
      }

      let currentCombo = ''
      if (modifiers.cmd) currentCombo += 'cmd+'
      else if (modifiers.ctrl) currentCombo += 'ctrl+'
      if (modifiers.alt) currentCombo += 'alt+'
      if (modifiers.shift) currentCombo += 'shift+'
      currentCombo += e.key.toLowerCase()

      for (const shortcut of shortcuts) {
        if (shortcut.keys.includes(currentCombo)) {
          e.preventDefault()
          shortcut.handler()
          break
        }
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      pressedKeys.current.delete(e.key.toLowerCase())
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [shortcuts])

  return (
    <KeyboardShortcutsContext.Provider
      value={{
        shortcuts,
        registerShortcut,
        unregisterShortcut,
        showShortcutsDialog,
        setShowShortcutsDialog
      }}
    >
      {children}
      {showShortcutsDialog && (
        <KeyboardShortcutsDialog onClose={() => setShowShortcutsDialog(false)} />
      )}
    </KeyboardShortcutsContext.Provider>
  )
}

const KeyboardShortcutsDialog: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { shortcuts } = useKeyboardShortcuts()
  
  const categories = {
    navigation: 'Navigation',
    app: 'Application',
    chat: 'Chat',
    editing: 'Editing',
    system: 'System'
  }

  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = []
    }
    acc[shortcut.category].push(shortcut)
    return acc
  }, {} as Record<string, Shortcut[]>)

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const formatKey = (key: string) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
    if (isMac) {
      return key
        .replace('cmd+', '⌘')
        .replace('alt+', '⌥')
        .replace('shift+', '⇧')
        .replace('ctrl+', '⌃')
    }
    return key
      .replace('cmd+', 'Ctrl+')
      .replace('alt+', 'Alt+')
      .replace('shift+', 'Shift+')
      .toUpperCase()
  }

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold">Keyboard Shortcuts</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <span className="sr-only">Close</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="max-h-[60vh] overflow-y-auto p-6">
            {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
              <div key={category} className="mb-6 last:mb-0">
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3">
                  {categories[category as keyof typeof categories]}
                </h3>
                <div className="space-y-2">
                  {categoryShortcuts.map(shortcut => (
                    <div 
                      key={shortcut.id}
                      className="flex items-center justify-between py-2"
                    >
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {shortcut.description}
                      </span>
                      <div className="flex gap-2">
                        {shortcut.keys.map((key, index) => (
                          <kbd
                            key={index}
                            className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 font-mono"
                          >
                            {formatKey(key)}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

export default KeyboardShortcutsProvider