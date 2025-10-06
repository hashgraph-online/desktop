declare module '@hashgraphonline/conversational-agent/dist/cjs/index.cjs' {
  export class AttachmentProcessor {
    constructor();
    processAttachments(
      content: string,
      attachments: Array<{
        name: string;
        data: string;
        type: string;
        size: number;
      }>,
      contentStoreManager?: {
        isInitialized(): boolean;
        storeContentIfLarge(
          buffer: Buffer,
          options: {
            mimeType: string;
            source: string;
            fileName: string;
            tags: string[];
          },
        ): Promise<{ referenceId: string } | null>;
      },
    ): Promise<string>;
  }
}
