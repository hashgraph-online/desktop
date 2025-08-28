import {
  detectHRLs,
  parseHRL,
  generateCDNUrl,
  detectInscriptionInMessage,
  hasInscriptions,
  getFirstInscription,
  type InscriptionData
} from '../../../src/renderer/utils/inscriptionDetector';

describe('inscriptionDetector', () => {
  describe('detectHRLs', () => {
    test('should detect single HRL in plain text', () => {
      const content = 'Check out this inscription: hcs://1/0.0.123456';
      const result = detectHRLs(content);

      expect(result).toEqual(['hcs://1/0.0.123456']);
    });

    test('should detect multiple HRLs in text', () => {
      const content = 'First: hcs://1/0.0.123456 and second: hcs://6/0.0.789012';
      const result = detectHRLs(content);

      expect(result).toEqual(['hcs://1/0.0.123456', 'hcs://6/0.0.789012']);
    });

    test('should detect HRLs with different file standards', () => {
      const content = 'hcs://1/0.0.111 hcs://2/0.0.222 hcs://3/0.0.333 hcs://4/0.0.444 hcs://5/0.0.555 hcs://6/0.0.666';
      const result = detectHRLs(content);

      expect(result).toEqual([
        'hcs://1/0.0.111',
        'hcs://2/0.0.222',
        'hcs://3/0.0.333',
        'hcs://4/0.0.444',
        'hcs://5/0.0.555',
        'hcs://6/0.0.666'
      ]);
    });

    test('should return empty array when no HRLs found', () => {
      const content = 'This is just regular text without any HRLs';
      const result = detectHRLs(content);

      expect(result).toEqual([]);
    });

    test('should handle empty content', () => {
      const result = detectHRLs('');

      expect(result).toEqual([]);
    });

    test('should not detect malformed HRLs', () => {
      const content = 'hcs://7/0.0.123456 hcs:/1/0.0.123456 hc://1/0.0.123456';
      const result = detectHRLs(content);

      expect(result).toEqual([]);
    });

    test('should detect HRLs with complex topic IDs', () => {
      const content = 'hcs://1/0.0.123456.789012 hcs://6/0.0.987654.321098';
      const result = detectHRLs(content);

      expect(result).toEqual(['hcs://1/0.0.123456.789012', 'hcs://6/0.0.987654.321098']);
    });

    test('should handle HRLs at the beginning and end of content', () => {
      const content = 'hcs://1/0.0.123456 some text hcs://6/0.0.789012';
      const result = detectHRLs(content);

      expect(result).toEqual(['hcs://1/0.0.123456', 'hcs://6/0.0.789012']);
    });
  });

  describe('parseHRL', () => {
    test('should parse valid Static HRL (file standard 1)', () => {
      const hrl = 'hcs://1/0.0.123456';
      const result = parseHRL(hrl);

      expect(result).toEqual({
        topicId: '0.0.123456',
        fileStandard: '1',
        standard: 'Static'
      });
    });

    test('should parse valid Dynamic HRL (file standard 6)', () => {
      const hrl = 'hcs://6/0.0.789012';
      const result = parseHRL(hrl);

      expect(result).toEqual({
        topicId: '0.0.789012',
        fileStandard: '6',
        standard: 'Dynamic'
      });
    });

    test('should parse HRL with complex topic ID', () => {
      const hrl = 'hcs://3/0.0.123456.789012';
      const result = parseHRL(hrl);

      expect(result).toEqual({
        topicId: '0.0.123456.789012',
        fileStandard: '3',
        standard: 'Static'
      });
    });

    test('should return null for malformed HRL', () => {
      const malformedHRLs = [
        'hcs://7/0.0.123456', // Invalid file standard
        'hcs:/1/0.0.123456',  // Missing slash
        'hc://1/0.0.123456',   // Missing 's'
        'hcs://1/',            // Missing topic ID
        'hcs://1',             // Missing topic ID
        '',                    // Empty string
        'not-an-hrl',          // Not an HRL
        'hcs://1/0.0.123456/extra' // Extra content
      ];

      malformedHRLs.forEach(hrl => {
        expect(parseHRL(hrl)).toBeNull();
      });
    });

    test('should parse all valid file standards', () => {
      const standards = ['1', '2', '3', '4', '5', '6'];

      standards.forEach(standard => {
        const hrl = `hcs://${standard}/0.0.123456`;
        const result = parseHRL(hrl);

        expect(result?.fileStandard).toBe(standard);
        expect(result?.standard).toBe(standard === '6' ? 'Dynamic' : 'Static');
        expect(result?.topicId).toBe('0.0.123456');
      });
    });
  });

  describe('generateCDNUrl', () => {
    test('should generate CDN URL for valid HRL with default network', () => {
      const hrl = 'hcs://1/0.0.123456';
      const result = generateCDNUrl(hrl);

      expect(result).toBe('https://kiloscribe.com/api/inscription-cdn/0.0.123456?network=testnet');
    });

    test('should generate CDN URL for valid HRL with mainnet', () => {
      const hrl = 'hcs://6/0.0.789012';
      const result = generateCDNUrl(hrl, 'mainnet');

      expect(result).toBe('https://kiloscribe.com/api/inscription-cdn/0.0.789012?network=mainnet');
    });

    test('should return null for malformed HRL', () => {
      const malformedHRLs = [
        'hcs://7/0.0.123456',
        'hcs:/1/0.0.123456',
        'invalid-hrl'
      ];

      malformedHRLs.forEach(hrl => {
        expect(generateCDNUrl(hrl)).toBeNull();
      });
    });

    test('should generate CDN URL with complex topic ID', () => {
      const hrl = 'hcs://3/0.0.123456.789012';
      const result = generateCDNUrl(hrl, 'mainnet');

      expect(result).toBe('https://kiloscribe.com/api/inscription-cdn/0.0.123456.789012?network=mainnet');
    });
  });

  describe('detectInscriptionInMessage', () => {
    test('should detect inscription in valid JSON response', () => {
      const messageContent = JSON.stringify({
        success: true,
        type: 'inscription',
        inscription: {
          hrl: 'hcs://1/0.0.123456',
          cdnUrl: 'https://example.com/cdn/0.0.123456'
        },
        metadata: {
          name: 'Test Inscription',
          creator: 'Test Creator',
          description: 'Test Description',
          type: 'image'
        }
      });

      const result = detectInscriptionInMessage(messageContent);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        hrl: 'hcs://1/0.0.123456',
        topicId: '0.0.123456',
        fileStandard: '1',
        standard: 'Static',
        cdnUrl: 'https://example.com/cdn/0.0.123456',
        metadata: {
          name: 'Test Inscription',
          creator: 'Test Creator',
          description: 'Test Description',
          type: 'image'
        }
      });
    });

    test('should detect inscription without CDN URL in JSON', () => {
      const messageContent = JSON.stringify({
        success: true,
        type: 'inscription',
        inscription: {
          hrl: 'hcs://6/0.0.789012'
        }
      });

      const result = detectInscriptionInMessage(messageContent);

      expect(result).toHaveLength(1);
      expect(result[0].hrl).toBe('hcs://6/0.0.789012');
      expect(result[0].topicId).toBe('0.0.789012');
      expect(result[0].fileStandard).toBe('6');
      expect(result[0].standard).toBe('Dynamic');
      expect(result[0].cdnUrl).toBe('https://kiloscribe.com/api/inscription-cdn/0.0.789012?network=testnet');
    });

    test('should detect HRLs in plain text when JSON parsing fails', () => {
      const messageContent = 'Check out this inscription: hcs://1/0.0.123456 and this one: hcs://6/0.0.789012';

      const result = detectInscriptionInMessage(messageContent);

      expect(result).toHaveLength(2);
      expect(result[0].hrl).toBe('hcs://1/0.0.123456');
      expect(result[1].hrl).toBe('hcs://6/0.0.789012');
    });

    test('should return empty array for invalid JSON without HRLs', () => {
      const messageContent = 'This is just regular text without any inscriptions';

      const result = detectInscriptionInMessage(messageContent);

      expect(result).toEqual([]);
    });

    test('should handle malformed JSON gracefully', () => {
      const messageContent = '{ invalid json content }';

      const result = detectInscriptionInMessage(messageContent);

      expect(result).toEqual([]);
    });

    test('should handle JSON without inscription data', () => {
      const messageContent = JSON.stringify({
        success: true,
        type: 'other',
        data: 'some data'
      });

      const result = detectInscriptionInMessage(messageContent);

      expect(result).toEqual([]);
    });

    test('should handle JSON with inscription but invalid HRL', () => {
      const messageContent = JSON.stringify({
        success: true,
        type: 'inscription',
        inscription: {
          hrl: 'invalid-hrl'
        }
      });

      const result = detectInscriptionInMessage(messageContent);

      expect(result).toEqual([]);
    });

    test('should detect multiple inscriptions in text', () => {
      const messageContent = 'hcs://1/0.0.111 hcs://2/0.0.222 hcs://6/0.0.333';

      const result = detectInscriptionInMessage(messageContent);

      expect(result).toHaveLength(3);
      expect(result.map(i => i.hrl)).toEqual([
        'hcs://1/0.0.111',
        'hcs://2/0.0.222',
        'hcs://6/0.0.333'
      ]);
    });

    test('should detect both JSON inscription and text HRLs', () => {
      const messageContent = JSON.stringify({
        success: true,
        type: 'inscription',
        inscription: {
          hrl: 'hcs://1/0.0.123456'
        }
      }) + ' and also hcs://6/0.0.789012 in text';

      const result = detectInscriptionInMessage(messageContent);

      expect(result).toHaveLength(2); // Both JSON and text HRLs
      expect(result[0].hrl).toBe('hcs://1/0.0.123456');
      expect(result[1].hrl).toBe('hcs://6/0.0.789012');
    });
  });

  describe('hasInscriptions', () => {
    test('should return true when message contains inscriptions', () => {
      const messageContent = JSON.stringify({
        success: true,
        type: 'inscription',
        inscription: { hrl: 'hcs://1/0.0.123456' }
      });

      const result = hasInscriptions(messageContent);
      expect(result).toBe(true);
    });

    test('should return true when message contains HRLs in text', () => {
      const messageContent = 'Check out hcs://6/0.0.789012';

      const result = hasInscriptions(messageContent);
      expect(result).toBe(true);
    });

    test('should return false when message has no inscriptions', () => {
      const messageContent = 'This is just regular text';

      const result = hasInscriptions(messageContent);
      expect(result).toBe(false);
    });

    test('should return false for empty content', () => {
      const result = hasInscriptions('');
      expect(result).toBe(false);
    });
  });

  describe('getFirstInscription', () => {
    test('should return first inscription from JSON', () => {
      const messageContent = JSON.stringify({
        success: true,
        type: 'inscription',
        inscription: { hrl: 'hcs://1/0.0.123456' }
      });

      const result = getFirstInscription(messageContent);

      expect(result?.hrl).toBe('hcs://1/0.0.123456');
    });

    test('should return first HRL from text', () => {
      const messageContent = 'First: hcs://1/0.0.111 Second: hcs://6/0.0.222';

      const result = getFirstInscription(messageContent);

      expect(result?.hrl).toBe('hcs://1/0.0.111');
    });

    test('should return null when no inscriptions found', () => {
      const messageContent = 'No inscriptions here';

      const result = getFirstInscription(messageContent);

      expect(result).toBeNull();
    });

    test('should return null for empty content', () => {
      const result = getFirstInscription('');
      expect(result).toBeNull();
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle complete inscription workflow', () => {
      const messageContent = JSON.stringify({
        success: true,
        type: 'inscription',
        inscription: {
          hrl: 'hcs://6/0.0.789012',
          cdnUrl: 'https://custom-cdn.com/0.0.789012'
        },
        metadata: {
          name: 'Dynamic Inscription',
          creator: 'Test Artist',
          type: 'video'
        }
      });

      expect(hasInscriptions(messageContent)).toBe(true);

      const inscription = getFirstInscription(messageContent);
      expect(inscription).not.toBeNull();
      expect(inscription?.hrl).toBe('hcs://6/0.0.789012');
      expect(inscription?.standard).toBe('Dynamic');
      expect(inscription?.cdnUrl).toBe('https://custom-cdn.com/0.0.789012');

      const inscriptions = detectInscriptionInMessage(messageContent);
      expect(inscriptions).toHaveLength(1);
    });

    test('should handle mixed content with both JSON and text HRLs', () => {
      const messageContent = JSON.stringify({
        success: true,
        type: 'inscription',
        inscription: { hrl: 'hcs://1/0.0.111' }
      }) + ' and also hcs://6/0.0.222 in text';

      const inscriptions = detectInscriptionInMessage(messageContent);
      expect(inscriptions).toHaveLength(2);
      expect(inscriptions[0].hrl).toBe('hcs://1/0.0.111');
      expect(inscriptions[1].hrl).toBe('hcs://6/0.0.222');
    });

    test('should handle error cases gracefully', () => {
      const errorCases = [
        '{ malformed json',
        'hcs://7/0.0.123456', // Invalid file standard
        '',
        '   ',
        '{}',
        '{"success": false}'
      ];

      errorCases.forEach(content => {
        expect(hasInscriptions(content)).toBe(false);
        expect(getFirstInscription(content)).toBeNull();
        expect(detectInscriptionInMessage(content)).toEqual([]);
      });
    });
  });

  describe('Edge Cases', () => {
    test('should handle very long topic IDs', () => {
      const longTopicId = '0.' + '1'.repeat(100);
      const hrl = `hcs://1/${longTopicId}`;
      const result = parseHRL(hrl);

      expect(result?.topicId).toBe(longTopicId);
      expect(result?.fileStandard).toBe('1');
      expect(result?.standard).toBe('Static');
    });

    test('should handle HRLs with numeric topic IDs', () => {
      const numericTopicId = '0.0.123456789';
      const hrl = `hcs://6/${numericTopicId}`;
      const result = parseHRL(hrl);

      expect(result?.topicId).toBe(numericTopicId);
      expect(result?.standard).toBe('Dynamic');
    });

    test('should handle case sensitivity', () => {
      expect(parseHRL('HCS://1/0.0.123456')).toBeNull(); // Should be lowercase
      expect(parseHRL('hcs://1/0.0.123456')).not.toBeNull(); // Correct case
    });

    test('should handle whitespace around HRLs', () => {
      const content = '  hcs://1/0.0.123456  ';
      const result = detectHRLs(content);

      expect(result).toEqual(['hcs://1/0.0.123456']);
    });
  });
});
