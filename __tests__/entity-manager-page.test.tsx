import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { EntityManagerPage } from '../desktop/src/renderer/pages/entity-manager-page';

/**
 * Mock window.electron with entity IPC methods
 */
const mockIpcRenderer = {
  invoke: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  send: jest.fn(),
};

Object.defineProperty(window, 'electron', {
  value: {
    ipcRenderer: mockIpcRenderer,
  },
  writable: true,
});

/**
 * Test data for entity associations
 */
const mockEntities = [
  {
    id: 1,
    entityId: '0.0.12345',
    entityName: 'Test Topic',
    entityType: 'topic',
    transactionId: '0.0.12345-123456789-000000000',
    sessionId: 'session-1',
    createdAt: new Date('2023-01-01T10:00:00Z'),
    updatedAt: new Date('2023-01-01T10:00:00Z'),
    isActive: true,
    metadata: null,
  },
  {
    id: 2,
    entityId: '0.0.67890',
    entityName: 'Test Token',
    entityType: 'token',
    transactionId: '0.0.67890-123456789-000000001',
    sessionId: 'session-1',
    createdAt: new Date('2023-01-02T10:00:00Z'),
    updatedAt: new Date('2023-01-02T10:00:00Z'),
    isActive: true,
    metadata: '{"symbol":"TTK","decimals":2}',
  },
];

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <MemoryRouter>
      {component}
    </MemoryRouter>
  );
};

describe('EntityManagerPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIpcRenderer.invoke.mockImplementation((channel: string) => {
      if (channel === 'entity:getAll') {
        return Promise.resolve({ success: true, data: mockEntities });
      }
      return Promise.resolve({ success: true, data: null });
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should render page header and title', async () => {
    renderWithRouter(<EntityManagerPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Entity Manager')).toBeInTheDocument();
    });
  });

  it('should load entities on mount', async () => {
    renderWithRouter(<EntityManagerPage />);
    
    await waitFor(() => {
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('entity:getAll', undefined);
    });
  });

  it('should display loading state initially', () => {
    renderWithRouter(<EntityManagerPage />);
    
    expect(screen.getByText('Loading entities...')).toBeInTheDocument();
  });

  it('should display entities after loading', async () => {
    renderWithRouter(<EntityManagerPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Topic')).toBeInTheDocument();
      expect(screen.getByText('Test Token')).toBeInTheDocument();
    });
  });

  it('should display search filter component', async () => {
    renderWithRouter(<EntityManagerPage />);
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search entities...')).toBeInTheDocument();
    });
  });

  it('should display entity type filter', async () => {
    renderWithRouter(<EntityManagerPage />);
    
    await waitFor(() => {
      expect(screen.getByLabelText('Entity Type')).toBeInTheDocument();
    });
  });

  it('should handle entity deletion', async () => {
    const user = userEvent.setup();
    mockIpcRenderer.invoke.mockImplementation((channel: string, ..._args: unknown[]) => {
      if (channel === 'entity:getAll') {
        return Promise.resolve({ success: true, data: mockEntities });
      }
      if (channel === 'entity:delete') {
        return Promise.resolve({ success: true });
      }
      return Promise.resolve({ success: true });
    });

    renderWithRouter(<EntityManagerPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Topic')).toBeInTheDocument();
    });

    const deleteButton = screen.getAllByLabelText('Delete entity')[0];
    await user.click(deleteButton);

    await waitFor(() => {
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('entity:delete', '0.0.12345');
    });
  });

  it('should handle search filtering', async () => {
    const user = userEvent.setup();
    renderWithRouter(<EntityManagerPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Topic')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search entities...');
    await user.type(searchInput, 'Topic');

    await waitFor(() => {
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('entity:getAll', { search: 'Topic' });
    });
  });

  it('should handle entity type filtering', async () => {
    const user = userEvent.setup();
    renderWithRouter(<EntityManagerPage />);
    
    await waitFor(() => {
      expect(screen.getByLabelText('Entity Type')).toBeInTheDocument();
    });

    const typeFilter = screen.getByLabelText('Entity Type');
    await user.selectOptions(typeFilter, 'topic');

    await waitFor(() => {
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('entity:getAll', { entityType: 'topic' });
    });
  });

  it('should display error message when loading fails', async () => {
    mockIpcRenderer.invoke.mockImplementation((channel: string) => {
      if (channel === 'entity:getAll') {
        return Promise.resolve({ success: false, error: 'Database connection failed' });
      }
      return Promise.resolve({ success: true });
    });

    renderWithRouter(<EntityManagerPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Error loading entities: Database connection failed')).toBeInTheDocument();
    });
  });

  it('should display bulk actions when entities are selected', async () => {
    const user = userEvent.setup();
    renderWithRouter(<EntityManagerPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Topic')).toBeInTheDocument();
    });

    const checkbox = screen.getAllByRole('checkbox')[0];
    await user.click(checkbox);

    await waitFor(() => {
      expect(screen.getByText('1 entity selected')).toBeInTheDocument();
      expect(screen.getByText('Delete Selected')).toBeInTheDocument();
    });
  });

  it('should handle bulk delete operation', async () => {
    const user = userEvent.setup();
    mockIpcRenderer.invoke.mockImplementation((channel: string, ..._args: unknown[]) => {
      if (channel === 'entity:getAll') {
        return Promise.resolve({ success: true, data: mockEntities });
      }
      if (channel === 'entity:bulkDelete') {
        return Promise.resolve({ success: true });
      }
      return Promise.resolve({ success: true });
    });

    renderWithRouter(<EntityManagerPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Topic')).toBeInTheDocument();
    });

    const checkbox = screen.getAllByRole('checkbox')[0];
    await user.click(checkbox);

    const deleteSelectedButton = await screen.findByText('Delete Selected');
    await user.click(deleteSelectedButton);

    const confirmButton = await screen.findByText('Confirm Delete');
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('entity:bulkDelete', ['0.0.12345']);
    });
  });

  it('should display empty state when no entities exist', async () => {
    mockIpcRenderer.invoke.mockImplementation((channel: string) => {
      if (channel === 'entity:getAll') {
        return Promise.resolve({ success: true, data: [] });
      }
      return Promise.resolve({ success: true });
    });

    renderWithRouter(<EntityManagerPage />);
    
    await waitFor(() => {
      expect(screen.getByText('No entities found')).toBeInTheDocument();
      expect(screen.getByText('Create entities using the available tools to see them here.')).toBeInTheDocument();
    });
  });

  it('should support virtual scrolling for large datasets', async () => {
    const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
      id: i + 1,
      entityId: `0.0.${12345 + i}`,
      entityName: `Entity ${i + 1}`,
      entityType: 'topic',
      transactionId: `0.0.${12345 + i}-123456789-00000000${i}`,
      sessionId: 'session-1',
      createdAt: new Date(`2023-01-01T${String(10 + (i % 12)).padStart(2, '0')}:00:00Z`),
      updatedAt: new Date(`2023-01-01T${String(10 + (i % 12)).padStart(2, '0')}:00:00Z`),
      isActive: true,
      metadata: null,
    }));

    mockIpcRenderer.invoke.mockImplementation((channel: string) => {
      if (channel === 'entity:getAll') {
        return Promise.resolve({ success: true, data: largeDataset });
      }
      return Promise.resolve({ success: true });
    });

    renderWithRouter(<EntityManagerPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Entity 1')).toBeInTheDocument();
    });

    expect(screen.queryByText('Entity 500')).not.toBeInTheDocument();
  });

  it('should handle real-time entity updates', async () => {
    renderWithRouter(<EntityManagerPage />);
    
    expect(mockIpcRenderer.on).toHaveBeenCalledWith('entity:created', expect.any(Function));
    expect(mockIpcRenderer.on).toHaveBeenCalledWith('entity:deleted', expect.any(Function));
  });

  it('should support export functionality', async () => {
    const user = userEvent.setup();
    mockIpcRenderer.invoke.mockImplementation((channel: string, ..._args: unknown[]) => {
      if (channel === 'entity:getAll') {
        return Promise.resolve({ success: true, data: mockEntities });
      }
      if (channel === 'entity:export') {
        return Promise.resolve({ success: true, data: 'exported-file-path' });
      }
      return Promise.resolve({ success: true });
    });

    renderWithRouter(<EntityManagerPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Export')).toBeInTheDocument();
    });

    const exportButton = screen.getByText('Export');
    await user.click(exportButton);

    const exportJsonButton = await screen.findByText('Export as JSON');
    await user.click(exportJsonButton);

    await waitFor(() => {
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('entity:export', undefined, 'json');
    });
  });
});