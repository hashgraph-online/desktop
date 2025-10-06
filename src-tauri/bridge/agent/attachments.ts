import type { AttachmentData, AttachmentDescriptor } from './types';

const decodeAttachment = (attachment: AttachmentDescriptor): string | null => {
  try {
    return Buffer.from(attachment.data, 'base64').toString('utf8');
  } catch {
    return null;
  }
};

export const extractPageContext = (
  attachments: ReadonlyArray<AttachmentDescriptor>
): Record<string, unknown> | null => {
  const candidate = attachments.find(
    (attachment) => attachment.name.toLowerCase() === 'page-context.json'
  );

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
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }

  return null;
};

export const buildPageContextPrompt = (
  context: Record<string, unknown>
): string => {
  const sections: string[] = ['Context extracted from the active browser tab:'];

  const pushLine = (label: string, value: unknown): void => {
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
        .filter((entry): entry is string =>
          typeof entry === 'string' && entry.trim().length > 0
        )
        .slice(0, 6)
    : [];

  if (favicons.length > 0) {
    sections.push(`Favicons: ${favicons.join(', ')}`);
  }

  return sections.join('\n');
};

export const normalizeAttachments = (
  attachments: ReadonlyArray<AttachmentDescriptor>
): AttachmentData[] =>
  attachments
    .map((attachment) => {
      if (
        !attachment ||
        typeof attachment.name !== 'string' ||
        typeof attachment.data !== 'string'
      ) {
        return null;
      }

      const type =
        typeof attachment.type === 'string' && attachment.type.length > 0
          ? attachment.type
          : 'application/octet-stream';
      const size =
        typeof attachment.size === 'number' && Number.isFinite(attachment.size)
          ? attachment.size
          : 0;

      return {
        name: attachment.name,
        data: attachment.data,
        type,
        size,
      } satisfies AttachmentData;
    })
    .filter((attachment): attachment is AttachmentData => Boolean(attachment));
