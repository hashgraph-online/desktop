import { useRef } from 'react'
import type { BrowserSurfaceRefs } from './types'

export const useBrowserRefs = (): BrowserSurfaceRefs => {
  const shellRootRef = useRef<HTMLDivElement | null>(null)
  const toolbarRef = useRef<HTMLDivElement | null>(null)
  const bookmarkBarRef = useRef<HTMLDivElement | null>(null)
  const browserContainerRef = useRef<HTMLDivElement | null>(null)
  const urlInputRef = useRef<HTMLInputElement | null>(null)

  return {
    shellRootRef,
    toolbarRef,
    bookmarkBarRef,
    browserContainerRef,
    urlInputRef
  }
}

