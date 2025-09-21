import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MediaLibrary } from '../../../src/renderer/components/media/MediaLibrary';

const buildJob = (overrides: Partial<Parameters<typeof MediaLibrary>[0]['jobs'][number]> = {}) => ({
  id: 'job-1',
  topic: '0.0.1001',
  imageTopic: '0.0.1001',
  mimeType: 'image/png',
  type: 'file',
  name: 'Retro Badge',
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  ...overrides,
});

const baseProps = {
  jobs: [] as ReturnType<typeof buildJob>[],
  isLoading: false,
  error: null,
  hasLoaded: true,
  network: 'testnet' as const,
  onRefresh: jest.fn(),
};

describe('MediaLibrary retro shell refinements', () => {
  it('anchors the search bar at the leading edge of the toolbar', () => {
    render(<MediaLibrary {...baseProps} />);

    const search = screen.getByTestId('media-toolbar-search');
    const viewToggle = screen.getByTestId('media-toolbar-view-toggle');

    expect(search.compareDocumentPosition(viewToggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('exposes topic id with copy controls in icon view', () => {
    const jobs = [buildJob()];

    render(<MediaLibrary {...baseProps} jobs={jobs} />);

    expect(screen.getByText(/Topic ID/i)).toHaveTextContent('Topic ID 0.0.1001');
    expect(screen.getAllByRole('button', { name: /copy topic id/i }).length).toBeGreaterThan(0);
  });

  it('surfaces topic column in list view without a date column', async () => {
    const user = userEvent.setup();
    const jobs = [buildJob()];

    render(<MediaLibrary {...baseProps} jobs={jobs} />);

    await user.click(screen.getByRole('button', { name: /list view/i }));

    expect(screen.queryByText(/Date Modified/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('media-list-header-topic')).toHaveTextContent('Topic ID');

    const row = screen.getByTestId('media-list-item-job-1');
    expect(within(row).getByRole('button', { name: /copy topic id/i })).toBeInTheDocument();
  });

  it('provides topic details within column view preview', async () => {
    const user = userEvent.setup();
    const jobs = [buildJob()];

    render(<MediaLibrary {...baseProps} jobs={jobs} />);

    await user.click(screen.getByRole('button', { name: /columns view/i }));

    const detailRegion = screen.getByTestId('media-column-preview');
    expect(within(detailRegion).getByText(/Topic ID 0.0.1001/)).toBeInTheDocument();
    expect(within(detailRegion).getByRole('button', { name: /copy topic id/i })).toBeInTheDocument();
  });

  it('renders toolbar controls and item counter', () => {
    render(<MediaLibrary {...baseProps} />);

    expect(screen.getByTestId('media-toolbar-search')).toBeInTheDocument();
    expect(screen.getByTestId('media-toolbar-view-toggle')).toBeInTheDocument();
    expect(screen.getAllByText(/items$/i)[0]).toBeInTheDocument();
  });
});
