import { renderHook } from '@testing-library/react'
import { useKeyboardNavigation } from '../../src/renderer/hooks/useKeyboardNavigation'

/**
 * Create a mock container with navigable elements
 */
function createMockContainer() {
  const container = document.createElement('div')
  
  const elements = [
    { tag: 'button', content: 'Button 1' },
    { tag: 'button', content: 'Button 2' },
    { tag: 'a', href: '#', content: 'Link 1' },
    { tag: 'div', role: 'menuitem', content: 'Menu Item' },
    { tag: 'div', tabindex: '0', content: 'Focusable Div' },
  ]

  elements.forEach((el, index) => {
    const element = document.createElement(el.tag)
    element.textContent = el.content
    
    if (el.href) element.setAttribute('href', el.href)
    if (el.role) element.setAttribute('role', el.role)
    if (el.tabindex) element.setAttribute('tabindex', el.tabindex)
    
    element.setAttribute('data-testid', `nav-element-${index}`)
    
    Object.defineProperty(element, 'offsetWidth', { value: 100 })
    Object.defineProperty(element, 'offsetHeight', { value: 30 })
    
    container.appendChild(element)
  })

  return { container, elements: container.querySelectorAll('[data-testid^="nav-element"]') }
}

/**
 * Create and dispatch keyboard event
 */
function createKeyboardEvent(key: string, target?: Element) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
  })
  
  Object.defineProperty(event, 'target', {
    value: target || document.body,
    enumerable: true,
  })
  
  return event
}

describe('useKeyboardNavigation', () => {
  let mockContainer: HTMLElement
  let mockElements: NodeListOf<Element>
  
  beforeEach(() => {
    const mock = createMockContainer()
    mockContainer = mock.container
    mockElements = mock.elements
    document.body.appendChild(mockContainer)
  })

  afterEach(() => {
    document.body.innerHTML = ''
    jest.clearAllMocks()
  })

  describe('initialization', () => {
    it('should return a ref object', () => {
      const { result } = renderHook(() => useKeyboardNavigation())
      
      expect(result.current).toHaveProperty('current')
      expect(result.current.current).toBeNull()
    })

    it('should attach ref to container', () => {
      const { result } = renderHook(() => useKeyboardNavigation())
      
      result.current.current = mockContainer
      
      expect(result.current.current).toBe(mockContainer)
    })
  })

  describe('vertical navigation', () => {
    it('should navigate down with ArrowDown', () => {
      const { result } = renderHook(() => useKeyboardNavigation({ orientation: 'vertical' }))
      result.current.current = mockContainer
      
      const firstElement = mockElements[0] as HTMLElement
      const secondElement = mockElements[1] as HTMLElement
      
      firstElement.focus()
      expect(document.activeElement).toBe(firstElement)
      
      const event = createKeyboardEvent('ArrowDown', firstElement)
      mockContainer.dispatchEvent(event)
      
      expect(document.activeElement).toBe(secondElement)
    })

    it('should navigate up with ArrowUp', () => {
      const { result } = renderHook(() => useKeyboardNavigation({ orientation: 'vertical' }))
      result.current.current = mockContainer
      
      const firstElement = mockElements[0] as HTMLElement
      const secondElement = mockElements[1] as HTMLElement
      
      secondElement.focus()
      expect(document.activeElement).toBe(secondElement)
      
      const event = createKeyboardEvent('ArrowUp', secondElement)
      mockContainer.dispatchEvent(event)
      
      expect(document.activeElement).toBe(firstElement)
    })

    it('should loop to first element when reaching end with loop enabled', () => {
      const { result } = renderHook(() => useKeyboardNavigation({ 
        orientation: 'vertical', 
        loop: true 
      }))
      result.current.current = mockContainer
      
      const firstElement = mockElements[0] as HTMLElement
      const lastElement = mockElements[mockElements.length - 1] as HTMLElement
      
      lastElement.focus()
      
      const event = createKeyboardEvent('ArrowDown', lastElement)
      mockContainer.dispatchEvent(event)
      
      expect(document.activeElement).toBe(firstElement)
    })

    it('should not loop when loop is disabled', () => {
      const { result } = renderHook(() => useKeyboardNavigation({ 
        orientation: 'vertical', 
        loop: false 
      }))
      result.current.current = mockContainer
      
      const lastElement = mockElements[mockElements.length - 1] as HTMLElement
      
      lastElement.focus()
      
      const event = createKeyboardEvent('ArrowDown', lastElement)
      mockContainer.dispatchEvent(event)
      
      expect(document.activeElement).toBe(lastElement)
    })
  })

  describe('horizontal navigation', () => {
    it('should navigate right with ArrowRight', () => {
      const { result } = renderHook(() => useKeyboardNavigation({ orientation: 'horizontal' }))
      result.current.current = mockContainer
      
      const firstElement = mockElements[0] as HTMLElement
      const secondElement = mockElements[1] as HTMLElement
      
      firstElement.focus()
      
      const event = createKeyboardEvent('ArrowRight', firstElement)
      mockContainer.dispatchEvent(event)
      
      expect(document.activeElement).toBe(secondElement)
    })

    it('should navigate left with ArrowLeft', () => {
      const { result } = renderHook(() => useKeyboardNavigation({ orientation: 'horizontal' }))
      result.current.current = mockContainer
      
      const firstElement = mockElements[0] as HTMLElement
      const secondElement = mockElements[1] as HTMLElement
      
      secondElement.focus()
      
      const event = createKeyboardEvent('ArrowLeft', secondElement)
      mockContainer.dispatchEvent(event)
      
      expect(document.activeElement).toBe(firstElement)
    })

    it('should ignore vertical arrow keys in horizontal mode', () => {
      const { result } = renderHook(() => useKeyboardNavigation({ orientation: 'horizontal' }))
      result.current.current = mockContainer
      
      const firstElement = mockElements[0] as HTMLElement
      
      firstElement.focus()
      
      const event = createKeyboardEvent('ArrowDown', firstElement)
      mockContainer.dispatchEvent(event)
      
      expect(document.activeElement).toBe(firstElement)
    })
  })

  describe('both orientation navigation', () => {
    it('should handle both vertical and horizontal navigation', () => {
      const { result } = renderHook(() => useKeyboardNavigation({ orientation: 'both' }))
      result.current.current = mockContainer
      
      const firstElement = mockElements[0] as HTMLElement
      const secondElement = mockElements[1] as HTMLElement
      
      firstElement.focus()
      
      const downEvent = createKeyboardEvent('ArrowDown', firstElement)
      mockContainer.dispatchEvent(downEvent)
      expect(document.activeElement).toBe(secondElement)
      
      const rightEvent = createKeyboardEvent('ArrowRight', secondElement)
      mockContainer.dispatchEvent(rightEvent)
      expect(document.activeElement).toBe(mockElements[2])
    })
  })

  describe('home and end navigation', () => {
    it('should navigate to first element with Home key', () => {
      const { result } = renderHook(() => useKeyboardNavigation())
      result.current.current = mockContainer
      
      const lastElement = mockElements[mockElements.length - 1] as HTMLElement
      const firstElement = mockElements[0] as HTMLElement
      
      lastElement.focus()
      
      const event = createKeyboardEvent('Home', lastElement)
      mockContainer.dispatchEvent(event)
      
      expect(document.activeElement).toBe(firstElement)
    })

    it('should navigate to last element with End key', () => {
      const { result } = renderHook(() => useKeyboardNavigation())
      result.current.current = mockContainer
      
      const firstElement = mockElements[0] as HTMLElement
      const lastElement = mockElements[mockElements.length - 1] as HTMLElement
      
      firstElement.focus()
      
      const event = createKeyboardEvent('End', firstElement)
      mockContainer.dispatchEvent(event)
      
      expect(document.activeElement).toBe(lastElement)
    })
  })

  describe('enter and space handling', () => {
    it('should call onEnter when Enter is pressed', () => {
      const onEnter = jest.fn()
      const { result } = renderHook(() => useKeyboardNavigation({ onEnter }))
      result.current.current = mockContainer
      
      const secondElement = mockElements[1] as HTMLElement
      secondElement.focus()
      
      const event = createKeyboardEvent('Enter', secondElement)
      mockContainer.dispatchEvent(event)
      
      expect(onEnter).toHaveBeenCalledWith(1)
    })

    it('should call onEnter when Space is pressed', () => {
      const onEnter = jest.fn()
      const { result } = renderHook(() => useKeyboardNavigation({ onEnter }))
      result.current.current = mockContainer
      
      const firstElement = mockElements[0] as HTMLElement
      firstElement.focus()
      
      const event = createKeyboardEvent(' ', firstElement)
      mockContainer.dispatchEvent(event)
      
      expect(onEnter).toHaveBeenCalledWith(0)
    })

    it('should not call onEnter when no element is focused', () => {
      const onEnter = jest.fn()
      const { result } = renderHook(() => useKeyboardNavigation({ onEnter }))
      result.current.current = mockContainer
      
      const event = createKeyboardEvent('Enter', mockContainer)
      mockContainer.dispatchEvent(event)
      
      expect(onEnter).not.toHaveBeenCalled()
    })
  })

  describe('escape handling', () => {
    it('should call onEscape when Escape is pressed', () => {
      const onEscape = jest.fn()
      const { result } = renderHook(() => useKeyboardNavigation({ onEscape }))
      result.current.current = mockContainer
      
      const firstElement = mockElements[0] as HTMLElement
      firstElement.focus()
      
      const event = createKeyboardEvent('Escape', firstElement)
      mockContainer.dispatchEvent(event)
      
      expect(onEscape).toHaveBeenCalled()
    })
  })

  describe('inactive state', () => {
    it('should not handle keyboard events when inactive', () => {
      const onEnter = jest.fn()
      const { result } = renderHook(() => useKeyboardNavigation({ 
        isActive: false, 
        onEnter 
      }))
      result.current.current = mockContainer
      
      const firstElement = mockElements[0] as HTMLElement
      firstElement.focus()
      
      const event = createKeyboardEvent('Enter', firstElement)
      mockContainer.dispatchEvent(event)
      
      expect(onEnter).not.toHaveBeenCalled()
    })
  })

  describe('element filtering', () => {
    it('should ignore hidden elements', () => {
      const { result } = renderHook(() => useKeyboardNavigation())
      result.current.current = mockContainer
      
      const firstElement = mockElements[0] as HTMLElement
      const secondElement = mockElements[1] as HTMLElement
      
      Object.defineProperty(secondElement, 'offsetWidth', { value: 0 })
      Object.defineProperty(secondElement, 'offsetHeight', { value: 0 })
      
      firstElement.focus()
      
      const event = createKeyboardEvent('ArrowDown', firstElement)
      mockContainer.dispatchEvent(event)
      
      expect(document.activeElement).toBe(mockElements[2])
    })

    it('should ignore disabled buttons', () => {
      const { result } = renderHook(() => useKeyboardNavigation())
      result.current.current = mockContainer
      
      const disabledButton = document.createElement('button')
      disabledButton.disabled = true
      disabledButton.textContent = 'Disabled Button'
      Object.defineProperty(disabledButton, 'offsetWidth', { value: 100 })
      Object.defineProperty(disabledButton, 'offsetHeight', { value: 30 })
      
      mockContainer.insertBefore(disabledButton, mockElements[1])
      
      const firstElement = mockElements[0] as HTMLElement
      firstElement.focus()
      
      const event = createKeyboardEvent('ArrowDown', firstElement)
      mockContainer.dispatchEvent(event)
      
      expect(document.activeElement).not.toBe(disabledButton)
      expect(document.activeElement).toBe(mockElements[1])
    })
  })

  describe('event boundaries', () => {
    it('should only handle events from within the container', () => {
      const onEnter = jest.fn()
      const { result } = renderHook(() => useKeyboardNavigation({ onEnter }))
      result.current.current = mockContainer
      
      const outsideElement = document.createElement('button')
      document.body.appendChild(outsideElement)
      outsideElement.focus()
      
      const event = createKeyboardEvent('Enter', outsideElement)
      mockContainer.dispatchEvent(event)
      
      expect(onEnter).not.toHaveBeenCalled()
    })
  })

  describe('cleanup', () => {
    it('should remove event listener on unmount', () => {
      const removeEventListenerSpy = jest.spyOn(HTMLElement.prototype, 'removeEventListener')
      
      const { result, unmount } = renderHook(() => useKeyboardNavigation())
      result.current.current = mockContainer
      
      unmount()
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
      
      removeEventListenerSpy.mockRestore()
    })
  })
})