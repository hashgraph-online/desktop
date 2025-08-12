import { useEffect, useRef, RefObject } from 'react'

interface UseKeyboardNavigationOptions {
  isActive?: boolean
  orientation?: 'horizontal' | 'vertical' | 'both'
  onEscape?: () => void
  onEnter?: (index: number) => void
  loop?: boolean
}

/**
 * Custom hook for keyboard navigation in lists, menus, and grids
 * Supports arrow key navigation with optional wrapping
 */
export const useKeyboardNavigation = <T extends HTMLElement>({
  isActive = true,
  orientation = 'vertical',
  onEscape,
  onEnter,
  loop = true
}: UseKeyboardNavigationOptions = {}): RefObject<T | null> => {
  const containerRef = useRef<T>(null)

  useEffect(() => {
    if (!isActive || !containerRef.current) return

    const container = containerRef.current
    
    const getNavigableElements = (): HTMLElement[] => {
      const selector = [
        '[role="menuitem"]',
        '[role="tab"]',
        '[role="option"]',
        'button:not([disabled])',
        'a[href]',
        '[tabindex="0"]'
      ].join(', ')

      return Array.from(container.querySelectorAll(selector))
        .filter(el => {
          const element = el as HTMLElement
          return element.offsetWidth > 0 && element.offsetHeight > 0
        }) as HTMLElement[]
    }

    const getCurrentIndex = (): number => {
      const elements = getNavigableElements()
      const activeElement = document.activeElement as HTMLElement
      return elements.indexOf(activeElement)
    }

    const focusElement = (index: number) => {
      const elements = getNavigableElements()
      if (elements[index]) {
        elements[index].focus()
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!container.contains(event.target as Node)) return

      const elements = getNavigableElements()
      if (elements.length === 0) return

      const currentIndex = getCurrentIndex()
      let nextIndex = currentIndex

      switch (event.key) {
        case 'ArrowDown':
          if (orientation === 'vertical' || orientation === 'both') {
            event.preventDefault()
            nextIndex = currentIndex + 1
            if (nextIndex >= elements.length) {
              nextIndex = loop ? 0 : elements.length - 1
            }
            focusElement(nextIndex)
          }
          break

        case 'ArrowUp':
          if (orientation === 'vertical' || orientation === 'both') {
            event.preventDefault()
            nextIndex = currentIndex - 1
            if (nextIndex < 0) {
              nextIndex = loop ? elements.length - 1 : 0
            }
            focusElement(nextIndex)
          }
          break

        case 'ArrowRight':
          if (orientation === 'horizontal' || orientation === 'both') {
            event.preventDefault()
            nextIndex = currentIndex + 1
            if (nextIndex >= elements.length) {
              nextIndex = loop ? 0 : elements.length - 1
            }
            focusElement(nextIndex)
          }
          break

        case 'ArrowLeft':
          if (orientation === 'horizontal' || orientation === 'both') {
            event.preventDefault()
            nextIndex = currentIndex - 1
            if (nextIndex < 0) {
              nextIndex = loop ? elements.length - 1 : 0
            }
            focusElement(nextIndex)
          }
          break

        case 'Home':
          event.preventDefault()
          focusElement(0)
          break

        case 'End':
          event.preventDefault()
          focusElement(elements.length - 1)
          break

        case 'Enter':
        case ' ':
          if (onEnter && currentIndex >= 0) {
            event.preventDefault()
            onEnter(currentIndex)
          }
          break

        case 'Escape':
          if (onEscape) {
            event.preventDefault()
            onEscape()
          }
          break
      }
    }

    container.addEventListener('keydown', handleKeyDown)

    return () => {
      container.removeEventListener('keydown', handleKeyDown)
    }
  }, [isActive, orientation, onEscape, onEnter, loop])

  return containerRef
}