#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const logging_1 = require("./agent/logging");
const environment_1 = require("./agent/environment");
const bridge_channel_1 = require("./agent/bridge-channel");
const runtime_1 = require("./agent/runtime");
const io_1 = require("./agent/io");
const logging = (0, logging_1.installLogging)();
(0, environment_1.setupProcessHandlers)(logging.writeStderr);
(0, environment_1.ensureBrowserLikeGlobals)();
const channel = new bridge_channel_1.BridgeChannel(logging.writeJsonLine, logging.logBridgeEvent);
const runtime = new runtime_1.BridgeRuntime({
    channel,
    logBridgeEvent: logging.logBridgeEvent,
    writeStderr: logging.writeStderr,
});
(0, io_1.startBridgeIO)(runtime, channel, logging.writeJsonLine, logging.writeStderr);
