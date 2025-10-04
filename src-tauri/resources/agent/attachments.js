"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeAttachments = exports.buildPageContextPrompt = exports.extractPageContext = void 0;
const decodeAttachment = (attachment) => {
    try {
        return Buffer.from(attachment.data, 'base64').toString('utf8');
    }
    catch {
        return null;
    }
};
const extractPageContext = (attachments) => {
    const candidate = attachments.find((attachment) => attachment.name.toLowerCase() === 'page-context.json');
    if (!candidate) {
        return null;
    }
    const decoded = decodeAttachment(candidate);
    if (!decoded) {
        return null;
    }
    try {
        const parsed = JSON.parse(decoded);
        if (parsed && typeof parsed === 'object') {
            return parsed;
        }
    }
    catch {
        return null;
    }
    return null;
};
exports.extractPageContext = extractPageContext;
const buildPageContextPrompt = (context) => {
    const sections = ['Context extracted from the active browser tab:'];
    const pushLine = (label, value) => {
        if (typeof value === 'string' && value.trim().length > 0) {
            sections.push(`${label}: ${value.trim()}`);
        }
    };
    pushLine('URL', context.url);
    pushLine('Title', context.title);
    pushLine('Host', context.host);
    pushLine('Description', context.description);
    pushLine('Selection', context.selection);
    const favicons = Array.isArray(context.favicons)
        ? context.favicons
            .filter((entry) => typeof entry === 'string' && entry.trim().length > 0)
            .slice(0, 6)
        : [];
    if (favicons.length > 0) {
        sections.push(`Favicons: ${favicons.join(', ')}`);
    }
    return sections.join('\n');
};
exports.buildPageContextPrompt = buildPageContextPrompt;
const normalizeAttachments = (attachments) => attachments
    .map((attachment) => {
    if (!attachment ||
        typeof attachment.name !== 'string' ||
        typeof attachment.data !== 'string') {
        return null;
    }
    const type = typeof attachment.type === 'string' && attachment.type.length > 0
        ? attachment.type
        : 'application/octet-stream';
    const size = typeof attachment.size === 'number' && Number.isFinite(attachment.size)
        ? attachment.size
        : 0;
    return {
        name: attachment.name,
        data: attachment.data,
        type,
        size,
    };
})
    .filter((attachment) => Boolean(attachment));
exports.normalizeAttachments = normalizeAttachments;
