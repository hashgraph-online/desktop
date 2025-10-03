import type { AssistantDock } from '../../../../shared/browser-layout'
import type { BrowserState } from '@/types/desktop-bridge'
import type { PageContext } from './scripts'

export interface BrowserSurfaceRefs {
  shellRootRef: React.MutableRefObject<HTMLDivElement | null>
  toolbarRef: React.MutableRefObject<HTMLDivElement | null>
  bookmarkBarRef: React.MutableRefObject<HTMLDivElement | null>
  browserContainerRef: React.MutableRefObject<HTMLDivElement | null>
  urlInputRef: React.MutableRefObject<HTMLInputElement | null>
}

export interface AssistantState {
  isOpen: boolean
  dock: AssistantDock
  width: number
  height: number
  sessionId: string | null
}

export interface BrowserSurfaceComputedState {
  bridgeState: BrowserState
  inputValue: string
  isBridgeAvailable: boolean
  fallbackUrl: string
  fallbackRevision: number
  hostLabel: string
  isDarkTheme: boolean
  isExpanded: boolean
  isAttached: boolean
  isReady: boolean
  assistant: AssistantState
  isBottomDock: boolean
}

export interface BrowserSurfaceHandlers {
  handleSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  handleUrlInputChange: (value: string) => void
  handleGoBack: () => void
  handleGoForward: () => void
  handleRefresh: () => void
  handleToggleAssistant: () => void
  handleAssistantClose: () => void
  handleSessionCreated: (sessionId: string) => void
  handleAssistantSessionsCleared: () => void
  handleAssistantDockChange: (dock: AssistantDock) => void
  handleAssistantResizeStart: (event: React.PointerEvent<HTMLDivElement>) => void
  handleAssistantResizeMouseStart: (event: React.MouseEvent<HTMLDivElement>) => void
  handleBookmarkSelect: (url: string) => void
  handleShellMinimize: () => void
  handleShellClose: () => void
  handleShellToggleExpand: () => void
}

export interface BrowserSurfaceContext {
  refs: BrowserSurfaceRefs
  state: BrowserSurfaceComputedState
  handlers: BrowserSurfaceHandlers
  fetchPageContext: () => Promise<PageContext | null>
  pageContext: PageContext | null
}
