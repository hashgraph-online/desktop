import React from 'react'
import ShellWindow from './ShellWindow'
import BrowserSurface from './browser/BrowserSurface'

const ShellBrowserWindow: React.FC = () => {
  return (
    <ShellWindow windowKey='browser' hideChrome>
      <BrowserSurface />
    </ShellWindow>
  )
}

export default ShellBrowserWindow

export { BrowserSurface as BrowserSurfaceForTesting }

