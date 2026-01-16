import React from 'react';
import { HashinalsWalletConnectSDK } from '@hashgraphonline/hashinal-wc';
import type { SignClientTypes } from '@walletconnect/types';
import { LedgerId } from '@hashgraph/sdk';
import { Logger } from '@hashgraphonline/standards-sdk';

const currentOrigin = ((): string => {
  try {
    if (
      typeof window !== 'undefined' &&
      window.location &&
      window.location.origin
    ) {
      return window.location.origin;
    }
  } catch {}
  return 'http://localhost';
})();
const meta: SignClientTypes.Metadata = {
  name: 'HOL Repro',
  description: 'WC Modal Repro',
  url: currentOrigin.startsWith('file:') ? 'http://localhost' : currentOrigin,
  icons: ['https://hashgraph.online/icon.png'],
};

const logger = new Logger({ module: 'WcReproPage' });

export const WcReproPage: React.FC = () => {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [attestationUrl, setAttestationUrl] = React.useState<string>('');
  const [embedUrl, setEmbedUrl] = React.useState<string>('');

  const handleOpen = async (): Promise<void> => {
    if (busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const pid = ((): string => {
        try {
          const saved = localStorage.getItem('app-config');
          if (saved) {
            const cfg = JSON.parse(saved);
            const maybe =
              cfg && cfg.walletConnect && cfg.walletConnect.projectId;
            if (typeof maybe === 'string' && maybe.trim()) {
              return String(maybe).trim();
            }
          }
        } catch {}
        return '55632c02cb971468424ae93c89366117';
      })();

      const sdk = HashinalsWalletConnectSDK.getInstance();
      sdk.setLogLevel('debug');
      logger.info('pid', pid);
      const connector = await sdk.init(pid, meta, LedgerId.TESTNET);
      logger.info('saved DAppConnector', connector);
      await connector.openModal();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <h1>WalletConnect Modal Repro</h1>
      <button onClick={handleOpen} disabled={busy}>
        {busy ? 'Opening…' : 'Open WC Modal'}
      </button>
      <button
        style={{ marginLeft: 8 }}
        onClick={async () => {
          try {
            const sdk = HashinalsWalletConnectSDK.getInstance();
            await sdk.disconnectAll();
          } catch {}
          try {
            const keys: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (!k) {
                continue;
              }
              if (
                k.includes('wc@') ||
                k.toLowerCase().includes('walletconnect')
              ) {
                keys.push(k);
              }
            }
            keys.forEach((k) => localStorage.removeItem(k));
          } catch {}
          try {
            const sKeys: string[] = [];
            for (let i = 0; i < sessionStorage.length; i++) {
              const k = sessionStorage.key(i);
              if (!k) {
                continue;
              }
              if (
                k.includes('wc@') ||
                k.toLowerCase().includes('walletconnect')
              ) {
                sKeys.push(k);
              }
            }
            sKeys.forEach((k) => sessionStorage.removeItem(k));
          } catch {}
          location.reload();
        }}
      >
        Reset WC Session
      </button>
      {error ? <pre>{error}</pre> : null}

      <hr style={{ margin: '16px 0' }} />
      <h2>Embed verify iframe manually</h2>
      <p>
        Paste the latest verify.walletconnect.org attestation URL from logs:
      </p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          style={{ flex: 1 }}
          placeholder='https://verify.walletconnect.org/v3/attestation?...'
          value={attestationUrl}
          onChange={(e) => setAttestationUrl(e.target.value)}
        />
        <button onClick={() => setEmbedUrl(attestationUrl)}>Embed</button>
      </div>
      {embedUrl ? (
        <div style={{ marginTop: 12, border: '1px solid #ccc' }}>
          <iframe
            title='wc-verify'
            src={embedUrl}
            width='100%'
            height={480}
            onLoad={() => logger.info('verify iframe loaded')}
            onError={() => console.error('verify iframe error')}
          />
        </div>
      ) : null}
    </div>
  );
};

export default WcReproPage;
