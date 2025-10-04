"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeBridgeResponse = exports.summarizeKeys = exports.installLogging = void 0;
const standards_sdk_1 = require("@hashgraphonline/standards-sdk");
const stringify = (value) => {
    if (typeof value === 'string') {
        return value;
    }
    try {
        return JSON.stringify(value);
    }
    catch {
        return String(value);
    }
};
const installLogging = () => {
    const originalStdoutWrite = process.stdout.write.bind(process.stdout);
    const bridgeLogger = standards_sdk_1.Logger.getInstance({ module: 'AgentBridge' });
    const writeStderr = (...args) => {
        const message = args.map(stringify).join(' ');
        process.stdout.write(`${message}\n`);
        process.stderr.write(`${message}\n`);
        if (args.length >= 2 &&
            typeof args[0] === 'string' &&
            typeof args[1] === 'object' &&
            args[1] !== null) {
            process.stdout.write(`${JSON.stringify(args[1])}\n`);
            process.stderr.write(`${JSON.stringify(args[1])}\n`);
        }
    };
    const redirectStdout = function (chunk, encoding, callback) {
        if (typeof encoding === 'function') {
            return process.stderr.write(chunk, encoding);
        }
        return process.stderr.write(chunk, encoding, callback);
    };
    process.stdout.write = redirectStdout;
    const writeJsonLine = (payload) => {
        originalStdoutWrite(`${JSON.stringify(payload)}\n`);
    };
    const logBridgeEvent = (event, details) => {
        if (details) {
            bridgeLogger.info(`[bridge] ${event}`, details);
            writeStderr(`[bridge] ${event}`, details);
            return;
        }
        bridgeLogger.info(`[bridge] ${event}`);
        writeStderr(`[bridge] ${event}`);
    };
    const forward = (...args) => {
        writeStderr(...args);
    };
    console.log = forward;
    console.info = forward;
    console.warn = forward;
    console.error = forward;
    return { writeJsonLine, logBridgeEvent, writeStderr };
};
exports.installLogging = installLogging;
const summarizeKeys = (value) => {
    if (typeof value !== 'object' || value === null) {
        return undefined;
    }
    return Object.keys(value).slice(0, 20);
};
exports.summarizeKeys = summarizeKeys;
const writeBridgeResponse = (writer, response) => {
    writer(response);
};
exports.writeBridgeResponse = writeBridgeResponse;
