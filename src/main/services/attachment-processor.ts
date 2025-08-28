import { Logger } from '../utils/logger';

export interface AttachmentData {
  name: string;
  data: string;
  type: string;
  size: number;
}

export interface ContentStoreManager {
  isInitialized(): boolean;
  storeContentIfLarge(
    buffer: Buffer,
    metadata: {
      mimeType: string;
      source: string;
      fileName: string;
      tags: string[];
    }
  ): Promise<{ referenceId: string } | null>;
}

/**
 * Utility for processing file attachments and content references
 */
export class AttachmentProcessor {
  private logger: Logger;

  constructor() {
    this.logger = new Logger({ module: 'AttachmentProcessor' });
  }

  /**
   * Process attachments and create content references
   */
  async processAttachments(
    content: string,
    attachments: AttachmentData[],
    contentStoreManager?: ContentStoreManager
  ): Promise<string> {
    if (attachments.length === 0) {
      return content;
    }

    this.logger.info('Processing attachments with content reference system:', {
      attachmentCount: attachments.length,
      totalSize: attachments.reduce((sum, att) => sum + att.size, 0),
    });

    if (contentStoreManager && contentStoreManager.isInitialized()) {
      return this.processWithContentStore(content, attachments, contentStoreManager);
    } else {
      this.logger.warn('Content storage not available, creating simple file references');
      return this.processWithSimpleReferences(content, attachments);
    }
  }

  /**
   * Process attachments using content store manager
   */
  private async processWithContentStore(
    content: string,
    attachments: AttachmentData[],
    contentStoreManager: ContentStoreManager
  ): Promise<string> {
    const contentReferences: string[] = [];

    for (const attachment of attachments) {
      try {
        const base64Data = attachment.data.includes('base64,')
          ? attachment.data.split('base64,')[1]
          : attachment.data;
        const buffer = Buffer.from(base64Data, 'base64');

        const contentRef = await contentStoreManager.storeContentIfLarge(
          buffer,
          {
            mimeType: attachment.type,
            source: 'user_upload',
            fileName: attachment.name,
            tags: ['attachment', 'user_file'],
          }
        );

        if (contentRef) {
          if (attachment.type.startsWith('image/')) {
            contentReferences.push(
              `[Image File: ${attachment.name}] (content-ref:${contentRef.referenceId})`
            );
          } else {
            contentReferences.push(
              `[File: ${attachment.name}] (content-ref:${contentRef.referenceId})`
            );
          }
        } else {
          contentReferences.push(
            this.createInlineReference(attachment, base64Data)
          );
        }
      } catch (error) {
        this.logger.error('Failed to process attachment:', {
          fileName: attachment.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        contentReferences.push(
          `[File: ${attachment.name} - Error processing file: ${
            error instanceof Error ? error.message : 'Unknown error'
          }]`
        );
      }
    }

    const fileList = this.createFileList(attachments);
    return content
      ? `${content}\n\nAttached files:\n${fileList}\n\n${contentReferences.join('\n')}`
      : `Attached files:\n${fileList}\n\n${contentReferences.join('\n')}`;
  }

  /**
   * Process attachments with simple file references
   */
  private processWithSimpleReferences(content: string, attachments: AttachmentData[]): string {
    const fileReferences = attachments.map((attachment) => {
      const sizeStr = this.formatFileSize(attachment.size);

      if (attachment.type.startsWith('image/')) {
        return `📎 Image: ${attachment.name} (${sizeStr}, ${attachment.type})`;
      } else {
        return `📎 File: ${attachment.name} (${sizeStr}, ${attachment.type})`;
      }
    });

    return content
      ? `${content}\n\nAttached files:\n${fileReferences.join('\n')}`
      : `Attached files:\n${fileReferences.join('\n')}`;
  }

  /**
   * Create inline reference for small files
   */
  private createInlineReference(attachment: AttachmentData, base64Data: string): string {
    if (attachment.size < 50000) {
      if (attachment.type.startsWith('image/')) {
        return `![${attachment.name}](data:${attachment.type};base64,${base64Data})`;
      } else {
        return `[File: ${attachment.name} (${this.formatFileSize(attachment.size)})]\nContent: ${base64Data}`;
      }
    } else {
      return `[File: ${attachment.name} (${this.formatFileSize(attachment.size)}) - Content too large to include inline]`;
    }
  }

  /**
   * Create formatted file list
   */
  private createFileList(attachments: AttachmentData[]): string {
    return attachments
      .map((file) => {
        const sizeStr = this.formatFileSize(file.size);
        return `📎 ${file.name} (${sizeStr})`;
      })
      .join('\n');
  }

  /**
   * Format file size for display
   */
  private formatFileSize(size: number): string {
    return size >= 1024 * 1024
      ? `${(size / (1024 * 1024)).toFixed(1)}MB`
      : `${(size / 1024).toFixed(1)}KB`;
  }
}