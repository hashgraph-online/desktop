import { setLoggerFactory } from '@hashgraphonline/standards-sdk'
import { createElectronLogger } from './utils/electron-logger-adapter'

setLoggerFactory(createElectronLogger)