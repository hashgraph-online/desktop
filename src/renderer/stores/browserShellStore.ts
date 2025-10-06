import { create } from 'zustand'

export const DEFAULT_BROWSER_URL = 'https://hedera.kiloscribe.com'

export interface BrowserBridgeState {
  requestedUrl: string
  currentUrl: string
  title: string
  isLoading: boolean
  canGoBack: boolean
  canGoForward: boolean
  lastError: string | null
}

const createInitialBridgeState = (): BrowserBridgeState => ({
  requestedUrl: DEFAULT_BROWSER_URL,
  currentUrl: DEFAULT_BROWSER_URL,
  title: '',
  isLoading: false,
  canGoBack: false,
  canGoForward: false,
  lastError: null
})

export const isBridgeStateEqual = (a: BrowserBridgeState, b: BrowserBridgeState): boolean =>
  a.requestedUrl === b.requestedUrl &&
  a.currentUrl === b.currentUrl &&
  a.title === b.title &&
  a.isLoading === b.isLoading &&
  a.canGoBack === b.canGoBack &&
  a.canGoForward === b.canGoForward &&
  a.lastError === b.lastError

export interface BrowserShellState {
  bridgeState: BrowserBridgeState
  inputValue: string
  fallbackUrl: string
  isAttached: boolean
  isReady: boolean
  setBridgeState: (updater: (prev: BrowserBridgeState) => BrowserBridgeState) => void
  replaceBridgeState: (next: BrowserBridgeState) => void
  setInputValue: (value: string) => void
  setFallbackUrl: (url: string) => void
  markAttached: () => void
  markDetached: () => void
  setIsReady: (value: boolean) => void
  reset: () => void
}

export const useBrowserShellStore = create<BrowserShellState>((set) => ({
  bridgeState: createInitialBridgeState(),
  inputValue: DEFAULT_BROWSER_URL,
  fallbackUrl: DEFAULT_BROWSER_URL,
  isAttached: false,
  isReady: false,

  setBridgeState: (updater) =>
    set((state) => {
      const next = updater(state.bridgeState)
      if (isBridgeStateEqual(state.bridgeState, next)) {
        return state
      }
      return {
        ...state,
        bridgeState: next
      }
    }),

  replaceBridgeState: (next) =>
    set((state) => {
      if (isBridgeStateEqual(state.bridgeState, next)) {
        return state
      }
      return {
        ...state,
        bridgeState: next
      }
    }),

  setInputValue: (value) =>
    set((state) => (state.inputValue === value ? state : { ...state, inputValue: value })),

  setFallbackUrl: (url) =>
    set((state) => (state.fallbackUrl === url ? state : { ...state, fallbackUrl: url })),

  markAttached: () =>
    set((state) => (state.isAttached ? state : { ...state, isAttached: true })),

  markDetached: () =>
    set((state) =>
      state.isAttached || state.isReady
        ? { ...state, isAttached: false, isReady: false }
        : state
    ),

  setIsReady: (value) =>
    set((state) => (state.isReady === value ? state : { ...state, isReady: value })),

  reset: () => ({
    bridgeState: createInitialBridgeState(),
    inputValue: DEFAULT_BROWSER_URL,
    fallbackUrl: DEFAULT_BROWSER_URL,
    isAttached: false,
    isReady: false
  })
}))
