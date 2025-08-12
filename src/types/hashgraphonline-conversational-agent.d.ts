declare module '@hashgraphonline/conversational-agent' {
  export type AgentOperationalMode = 'autonomous' | 'returnBytes';
  
  export interface MCPServerConfig {
    name: string;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    url?: string;
    transport?: 'stdio' | 'http' | 'https';
    autoConnect?: boolean;
    enabled?: boolean;
  }

  export interface ConversationalAgentOptions {
    operationalMode?: AgentOperationalMode;
    openaiApiKey?: string;
    network?: string;
    accountId?: string;
    privateKey?: string;
    mcpServers?: MCPServerConfig[];
    [key: string]: any;
  }

  export interface ContentStoreManager {
    isInitialized(): boolean;
    storeContentIfLarge(buffer: Buffer, metadata: any): Promise<any>;
    [key: string]: any;
  }

  export class ConversationalAgent {
    constructor(options: ConversationalAgentOptions);
    memoryManager?: {
      contentStorage?: any;
      [key: string]: any;
    };
    logger?: {
      info: (...args: any[]) => void;
      error: (...args: any[]) => void;
      warn: (...args: any[]) => void;
      debug: (...args: any[]) => void;
    };
    initialize(): Promise<void>;
    processMessage(message: string, conversationIdOrChatHistory?: string | any[]): Promise<any>;
    disconnect(): Promise<void>;
    cleanup(): Promise<void>;
    getAgent(): any;
    switchMode(mode: AgentOperationalMode): void;
    executeToolCall(toolCall: any): Promise<any>;
    getAvailableTools(): any[];
    connectMCPServers(servers?: MCPServerConfig[]): Promise<void>;
    getContentStoreManager(): ContentStoreManager | undefined;
  }
}