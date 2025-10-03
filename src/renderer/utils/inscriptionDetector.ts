/**
 * Utility for detecting and extracting inscription metadata from messages
 */

interface InscriptionData {
  /** The HRL (Hashinal Reference Link) */
  hrl: string;
  /** Topic ID extracted from HRL */
  topicId: string;
  /** File standard (1 for Static, 6 for Dynamic) */
  fileStandard: string;
  /** Type of Hashinal */
  standard: 'Static' | 'Dynamic';
  /** CDN URL for direct access */
  cdnUrl: string;
  /** Associated metadata if available */
  metadata?: {
    name?: string;
    creator?: string;
    description?: string;
    type?: string;
  };
}

/**
 * Detects HRL references in message content
 */
export function detectHRLs(content: string): string[] {
  const hrlPattern = /hcs:\/\/([1-6])\/([0-9.]+)/g;
  const matches: string[] = [];
  let match;
  
  while ((match = hrlPattern.exec(content)) !== null) {
    matches.push(match[0]);
  }
  
  return matches;
}

/**
 * Parses an HRL to extract its components
 */
export function parseHRL(hrl: string): { topicId: string; fileStandard: string; standard: 'Static' | 'Dynamic' } | null {
  const hrlPattern = /^hcs:\/\/([1-6])\/([0-9.]+)$/;
  const match = hrl.match(hrlPattern);
  
  if (!match) return null;
  
  const fileStandard = match[1];
  const topicId = match[2];
  const standard = fileStandard === '6' ? 'Dynamic' : 'Static';
  
  return { topicId, fileStandard, standard };
}

/**
 * Generates CDN URL for a given HRL and network
 */
export function generateCDNUrl(hrl: string, network: 'mainnet' | 'testnet' = 'testnet'): string | null {
  const parsed = parseHRL(hrl);
  if (!parsed) return null;
  
  return `https://kiloscribe.com/api/inscription-cdn/${parsed.topicId}?network=${network}`;
}

/**
 * Detects inscription metadata in structured tool responses
 */
export function detectInscriptionInMessage(messageContent: string): InscriptionData[] {
  const inscriptions: InscriptionData[] = [];
  
  try {
    const parsed = JSON.parse(messageContent);
    
    if (parsed.success && parsed.type === 'inscription' && parsed.inscription?.hrl) {
      const hrlData = parseHRL(parsed.inscription.hrl);
      if (hrlData) {
        inscriptions.push({
          hrl: parsed.inscription.hrl,
          topicId: hrlData.topicId,
          fileStandard: hrlData.fileStandard,
          standard: hrlData.standard,
          cdnUrl: parsed.inscription.cdnUrl || generateCDNUrl(parsed.inscription.hrl) || '',
          metadata: parsed.metadata,
        });
      }
    }
  } catch {
    const hrls = detectHRLs(messageContent);
    
    for (const hrl of hrls) {
      const hrlData = parseHRL(hrl);
      if (hrlData) {
        const cdnUrl = generateCDNUrl(hrl);
        if (cdnUrl) {
          inscriptions.push({
            hrl,
            topicId: hrlData.topicId,
            fileStandard: hrlData.fileStandard,
            standard: hrlData.standard,
            cdnUrl,
          });
        }
      }
    }
  }
  
  return inscriptions;
}

/**
 * Checks if a message contains inscription references
 */
export function hasInscriptions(messageContent: string): boolean {
  return detectInscriptionInMessage(messageContent).length > 0;
}

/**
 * Extracts the first inscription from a message, if any
 */
export function getFirstInscription(messageContent: string): InscriptionData | null {
  const inscriptions = detectInscriptionInMessage(messageContent);
  return inscriptions.length > 0 ? inscriptions[0] : null;
}