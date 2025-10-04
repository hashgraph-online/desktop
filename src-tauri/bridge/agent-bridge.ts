#!/usr/bin/env node

import { installLogging } from './agent/logging';
import { ensureBrowserLikeGlobals, setupProcessHandlers } from './agent/environment';
import { BridgeChannel } from './agent/bridge-channel';
import { BridgeRuntime } from './agent/runtime';
import { startBridgeIO } from './agent/io';

const logging = installLogging();

setupProcessHandlers(logging.writeStderr);
ensureBrowserLikeGlobals();

const channel = new BridgeChannel(
  logging.writeJsonLine,
  logging.logBridgeEvent
);

const runtime = new BridgeRuntime({
  channel,
  logBridgeEvent: logging.logBridgeEvent,
  writeStderr: logging.writeStderr,
});

startBridgeIO(runtime, channel, logging.writeJsonLine, logging.writeStderr);
