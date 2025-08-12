import { act, renderHook } from '@testing-library/react'
import { 
  useResponsive, 
  useMediaQuery, 
  useBreakpoint, 
  usePrefersReducedMotion,
  usePrefersColorScheme,
  usePrefersHighContrast 
} from '../../src/renderer/hooks/useResponsive'

/**
 * Mock window dimensions and media queries
 */
function mockWindowDimensions(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  })
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: height,
  })
}

/**
 * Mock media query list
 */
function createMockMediaQueryList(matches: boolean): MediaQueryList {
  return {
    matches,
    media: '',
    onchange: null,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    dispatchEvent: jest.fn(),
  } as MediaQueryList
}

describe('useResponsive', () => {
  let mockMediaQueryList: MediaQueryList
  let originalMatchMedia: typeof window.matchMedia

  beforeEach(() => {
    originalMatchMedia = window.matchMedia
    mockMediaQueryList = createMockMediaQueryList(false)
    
    window.matchMedia = jest.fn().mockReturnValue(mockMediaQueryList)
    
    jest.useFakeTimers()
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
    jest.useRealTimers()
    jest.clearAllMocks()
  })

  describe('initialization', () => {
    it('should initialize with correct mobile state', () => {
      mockWindowDimensions(500, 800)
      const { result } = renderHook(() => useResponsive())

      expect(result.current.width).toBe(500)
      expect(result.current.height).toBe(800)
      expect(result.current.breakpoint).toBe('sm')
      expect(result.current.isMobile).toBe(true)
      expect(result.current.isTablet).toBe(false)
      expect(result.current.isDesktop).toBe(false)
      expect(result.current.isLandscape).toBe(false)
      expect(result.current.isPortrait).toBe(true)
    })

    it('should initialize with correct tablet state', () => {
      mockWindowDimensions(900, 600)
      const { result } = renderHook(() => useResponsive())

      expect(result.current.width).toBe(900)
      expect(result.current.height).toBe(600)
      expect(result.current.breakpoint).toBe('md')
      expect(result.current.isMobile).toBe(false)
      expect(result.current.isTablet).toBe(true)
      expect(result.current.isDesktop).toBe(false)
      expect(result.current.isLandscape).toBe(true)
      expect(result.current.isPortrait).toBe(false)
    })

    it('should initialize with correct desktop state', () => {
      mockWindowDimensions(1400, 900)
      const { result } = renderHook(() => useResponsive())

      expect(result.current.width).toBe(1400)
      expect(result.current.height).toBe(900)
      expect(result.current.breakpoint).toBe('xl')
      expect(result.current.isMobile).toBe(false)
      expect(result.current.isTablet).toBe(false)
      expect(result.current.isDesktop).toBe(true)
      expect(result.current.isLandscape).toBe(true)
      expect(result.current.isPortrait).toBe(false)
    })
  })

  describe('breakpoint detection', () => {
    it('should detect xs breakpoint', () => {
      mockWindowDimensions(400, 600)
      const { result } = renderHook(() => useResponsive())

      expect(result.current.breakpoint).toBe('xs')
    })

    it('should detect sm breakpoint', () => {
      mockWindowDimensions(640, 600)
      const { result } = renderHook(() => useResponsive())

      expect(result.current.breakpoint).toBe('sm')
    })

    it('should detect md breakpoint', () => {
      mockWindowDimensions(768, 600)
      const { result } = renderHook(() => useResponsive())

      expect(result.current.breakpoint).toBe('md')
    })

    it('should detect lg breakpoint', () => {
      mockWindowDimensions(1024, 600)
      const { result } = renderHook(() => useResponsive())

      expect(result.current.breakpoint).toBe('lg')
    })

    it('should detect xl breakpoint', () => {
      mockWindowDimensions(1280, 600)
      const { result } = renderHook(() => useResponsive())

      expect(result.current.breakpoint).toBe('xl')
    })

    it('should detect 2xl breakpoint', () => {
      mockWindowDimensions(1600, 600)
      const { result } = renderHook(() => useResponsive())

      expect(result.current.breakpoint).toBe('2xl')
    })
  })

  describe('resize handling', () => {
    it('should update state on window resize with debouncing', () => {
      mockWindowDimensions(500, 800)
      const { result } = renderHook(() => useResponsive())

      expect(result.current.isMobile).toBe(true)

      act(() => {
        mockWindowDimensions(1200, 800)
        window.dispatchEvent(new Event('resize'))
      })

      expect(result.current.isMobile).toBe(true)

      act(() => {
        jest.advanceTimersByTime(150)
      })

      expect(result.current.isMobile).toBe(false)
      expect(result.current.isDesktop).toBe(true)
      expect(result.current.width).toBe(1200)
    })

    it('should handle orientation change', () => {
      mockWindowDimensions(800, 500)
      const { result } = renderHook(() => useResponsive())

      expect(result.current.isLandscape).toBe(true)

      act(() => {
        mockWindowDimensions(500, 800)
        window.dispatchEvent(new Event('orientationchange'))
        jest.advanceTimersByTime(150)
      })

      expect(result.current.isLandscape).toBe(false)
      expect(result.current.isPortrait).toBe(true)
    })

    it('should debounce multiple resize events', () => {
      mockWindowDimensions(500, 800)
      const { result } = renderHook(() => useResponsive())

      act(() => {
        mockWindowDimensions(600, 800)
        window.dispatchEvent(new Event('resize'))
        
        mockWindowDimensions(700, 800)
        window.dispatchEvent(new Event('resize'))
        
        mockWindowDimensions(800, 800)
        window.dispatchEvent(new Event('resize'))
      })

      expect(result.current.width).toBe(500)

      act(() => {
        jest.advanceTimersByTime(150)
      })

      expect(result.current.width).toBe(800)
    })
  })

  describe('cleanup', () => {
    it('should remove event listeners on unmount', () => {
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener')
      const { unmount } = renderHook(() => useResponsive())

      unmount()

      expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function))
      expect(removeEventListenerSpy).toHaveBeenCalledWith('orientationchange', expect.any(Function))
    })
  })
})

describe('useMediaQuery', () => {
  let mockMediaQueryList: MediaQueryList
  let originalMatchMedia: typeof window.matchMedia

  beforeEach(() => {
    originalMatchMedia = window.matchMedia
    mockMediaQueryList = createMockMediaQueryList(false)
    window.matchMedia = jest.fn().mockReturnValue(mockMediaQueryList)
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
    jest.clearAllMocks()
  })

  it('should return initial match state', () => {
    mockMediaQueryList.matches = true
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))

    expect(result.current).toBe(true)
  })

  it('should update when media query changes', () => {
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))

    expect(result.current).toBe(false)

    act(() => {
      const changeHandler = (mockMediaQueryList.addEventListener as jest.Mock).mock.calls[0][1]
      changeHandler({ matches: true })
    })

    expect(result.current).toBe(true)
  })

  it('should use legacy addListener when addEventListener is not available', () => {
    const mockLegacyMediaQueryList = {
      ...mockMediaQueryList,
      addEventListener: undefined,
      removeEventListener: undefined,
    }
    
    window.matchMedia = jest.fn().mockReturnValue(mockLegacyMediaQueryList)

    renderHook(() => useMediaQuery('(min-width: 768px)'))

    expect(mockLegacyMediaQueryList.addListener).toHaveBeenCalled()
  })
})

describe('useBreakpoint', () => {
  let originalMatchMedia: typeof window.matchMedia

  beforeEach(() => {
    originalMatchMedia = window.matchMedia
    window.matchMedia = jest.fn().mockReturnValue(createMockMediaQueryList(true))
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
  })

  it('should create correct media query for breakpoint', () => {
    renderHook(() => useBreakpoint('lg'))

    expect(window.matchMedia).toHaveBeenCalledWith('(min-width: 1024px)')
  })

  it('should return correct value for different breakpoints', () => {
    const { result } = renderHook(() => useBreakpoint('md'))

    expect(result.current).toBe(true)
  })
})

describe('usePrefersReducedMotion', () => {
  let originalMatchMedia: typeof window.matchMedia

  beforeEach(() => {
    originalMatchMedia = window.matchMedia
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
  })

  it('should detect reduced motion preference', () => {
    window.matchMedia = jest.fn().mockReturnValue(createMockMediaQueryList(true))
    const { result } = renderHook(() => usePrefersReducedMotion())

    expect(window.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)')
    expect(result.current).toBe(true)
  })
})

describe('usePrefersColorScheme', () => {
  let originalMatchMedia: typeof window.matchMedia

  beforeEach(() => {
    originalMatchMedia = window.matchMedia
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
  })

  it('should detect dark color scheme preference', () => {
    window.matchMedia = jest.fn()
      .mockReturnValueOnce(createMockMediaQueryList(true))
      .mockReturnValueOnce(createMockMediaQueryList(false))

    const { result } = renderHook(() => usePrefersColorScheme())

    expect(result.current).toBe('dark')
  })

  it('should detect light color scheme preference', () => {
    window.matchMedia = jest.fn()
      .mockReturnValueOnce(createMockMediaQueryList(false))
      .mockReturnValueOnce(createMockMediaQueryList(true))

    const { result } = renderHook(() => usePrefersColorScheme())

    expect(result.current).toBe('light')
  })

  it('should return no-preference when neither is preferred', () => {
    window.matchMedia = jest.fn()
      .mockReturnValueOnce(createMockMediaQueryList(false))
      .mockReturnValueOnce(createMockMediaQueryList(false))

    const { result } = renderHook(() => usePrefersColorScheme())

    expect(result.current).toBe('no-preference')
  })
})

describe('usePrefersHighContrast', () => {
  let originalMatchMedia: typeof window.matchMedia

  beforeEach(() => {
    originalMatchMedia = window.matchMedia
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
  })

  it('should detect high contrast preference', () => {
    window.matchMedia = jest.fn().mockReturnValue(createMockMediaQueryList(true))
    const { result } = renderHook(() => usePrefersHighContrast())

    expect(window.matchMedia).toHaveBeenCalledWith('(prefers-contrast: high)')
    expect(result.current).toBe(true)
  })
})