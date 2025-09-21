import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InscriptionSelect } from '../src/renderer/components/hcs10/InscriptionSelect';
import { useWalletStore } from '../src/renderer/stores/walletStore';

/**
 * Sample inscription job returned by the Kiloscribe jobs endpoint
 */
const mockJobResponse = [
  {
    tx_id: '0.0.1234-1717171717-000000001',
    topic_id: '0.0.5678',
    mimeType: 'image/png',
    createdAt: '2024-01-01T00:00:00.000Z',
    type: 'file',
    name: 'Profile Icon',
  },
];

describe('InscriptionSelect existing inscriptions', () => {
  const createFetchResponse = () =>
    ({
      ok: true,
      json: async () => mockJobResponse,
    }) as Response;
  let fetchSpy: jest.SpyInstance;
  let createdFetchStub = false;

  beforeEach(() => {
    if (typeof global.fetch !== 'function') {
      global.fetch = (jest.fn(() => Promise.resolve(createFetchResponse())) as unknown) as typeof fetch;
      createdFetchStub = true;
    }

    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(createFetchResponse());

    act(() => {
      useWalletStore.setState({
        isConnected: true,
        accountId: '0.0.1234',
        network: 'testnet',
      });
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();

    if (createdFetchStub) {
      delete (global as { fetch?: typeof fetch }).fetch;
      createdFetchStub = false;
    }

    act(() => {
      useWalletStore.setState({
        isConnected: false,
        accountId: null,
        network: 'testnet',
      });
    });
  });

  it('loads previous inscriptions on demand', async () => {
    const user = userEvent.setup();
    const handleChange = jest.fn();

    render(
      <InscriptionSelect
        onChange={handleChange}
        introMessage='Intro'
        warningMessage='Warning'
        network='testnet'
        messageEnabled
      />
    );

    const loadButton = screen.getByRole('button', {
      name: /load existing inscriptions/i,
    });
    await user.click(loadButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('https://kiloscribe.com/api/jobs', {
        headers: {
          'x-account-id': '0.0.1234',
          'x-type': 'file',
        },
        method: 'GET',
      });
    });

    expect(
      await screen.findByText('Profile Icon')
    ).toBeInTheDocument();
  });

  it('selects an existing inscription and emits hcs url', async () => {
    const user = userEvent.setup();
    const handleChange = jest.fn();

    render(
      <InscriptionSelect
        onChange={handleChange}
        introMessage='Intro'
        warningMessage='Warning'
        network='testnet'
        messageEnabled
      />
    );

    const loadButton = screen.getByRole('button', {
      name: /load existing inscriptions/i,
    });
    await user.click(loadButton);

    const selectButton = await screen.findByRole('button', {
      name: /use profile icon/i,
    });
    await user.click(selectButton);

    expect(handleChange).toHaveBeenCalledWith('hcs://1/0.0.5678');
  });
});
