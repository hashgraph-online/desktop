"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureBrowserLikeGlobals = exports.setupProcessHandlers = void 0;
const formatErrorPayload = (error, type) => ({
    type,
    message: error.message ?? String(error),
    stack: error.stack ?? 'No stack trace available',
    error: String(error),
});
const setupProcessHandlers = (writeStderr) => {
    process.on('uncaughtException', (error) => {
        writeStderr(JSON.stringify(formatErrorPayload(error, 'uncaught_exception')));
        process.exit(1);
    });
    process.on('unhandledRejection', (reason) => {
        const error = reason instanceof Error ? reason : new Error(String(reason));
        writeStderr(JSON.stringify(formatErrorPayload(error, 'unhandled_rejection')));
        process.exit(1);
    });
};
exports.setupProcessHandlers = setupProcessHandlers;
const ensureBrowserLikeGlobals = () => {
    const windowValue = Reflect.get(globalThis, 'window');
    if (typeof windowValue === 'undefined') {
        const windowLike = {};
        if (typeof globalThis.crypto !== 'undefined') {
            windowLike.crypto = globalThis.crypto;
        }
        Reflect.set(globalThis, 'window', windowLike);
    }
    else if (typeof windowValue === 'object' &&
        windowValue !== null &&
        typeof Reflect.get(windowValue, 'crypto') === 'undefined' &&
        typeof globalThis.crypto !== 'undefined') {
        Reflect.set(windowValue, 'crypto', globalThis.crypto);
    }
    if (typeof Reflect.get(globalThis, 'self') === 'undefined') {
        Reflect.set(globalThis, 'self', globalThis);
    }
    const navigatorValue = Reflect.get(globalThis, 'navigator');
    if (typeof navigatorValue !== 'object' || navigatorValue === null) {
        Reflect.set(globalThis, 'navigator', { userAgent: 'node' });
        return;
    }
    const currentUserAgent = Reflect.get(navigatorValue, 'userAgent');
    if (typeof currentUserAgent !== 'string' || currentUserAgent.trim().length === 0) {
        Reflect.set(navigatorValue, 'userAgent', 'node');
    }
};
exports.ensureBrowserLikeGlobals = ensureBrowserLikeGlobals;
