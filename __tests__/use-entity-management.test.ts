import { renderHook, act, waitFor } from '@testing-library/react';
import { useEntityManagement } from '../desktop/src/renderer/hooks/use-entity-management';

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

describe('useEntityManagement', () => {
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

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useEntityManagement());
    
    expect(result.current.entities).toEqual([]);
    expect(result.current.filteredEntities).toEqual([]);
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBe(null);
    expect(result.current.selectedEntities).toEqual(new Set());
    expect(result.current.filters).toEqual({
      search: '',
      entityType: '',
      dateRange: { start: null, end: null },
      sessionId: '',
    });
  });

  it('should load entities on mount', async () => {
    const { result } = renderHook(() => useEntityManagement());
    
    await waitFor(() => {
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('entity:getAll', undefined);
      expect(result.current.loading).toBe(false);
      expect(result.current.entities).toEqual(mockEntities);
    });
  });

  it('should handle loading errors', async () => {
    mockIpcRenderer.invoke.mockImplementation((channel: string) => {
      if (channel === 'entity:getAll') {
        return Promise.resolve({ success: false, error: 'Database connection failed' });
      }
      return Promise.resolve({ success: true });
    });
    
    const { result } = renderHook(() => useEntityManagement());
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe('Database connection failed');
      expect(result.current.entities).toEqual([]);
    });
  });

  it('should filter entities based on search query', async () => {
    const { result } = renderHook(() => useEntityManagement());
    
    await waitFor(() => {
      expect(result.current.entities).toEqual(mockEntities);
    });
    
    act(() => {
      result.current.updateFilters({ search: 'Topic' });
    });
    
    expect(result.current.filteredEntities).toEqual([mockEntities[0]]);
  });

  it('should filter entities by type', async () => {
    const { result } = renderHook(() => useEntityManagement());
    
    await waitFor(() => {
      expect(result.current.entities).toEqual(mockEntities);
    });
    
    act(() => {
      result.current.updateFilters({ entityType: 'token' });
    });
    
    expect(result.current.filteredEntities).toEqual([mockEntities[1]]);
  });

  it('should filter entities by date range', async () => {
    const { result } = renderHook(() => useEntityManagement());
    
    await waitFor(() => {
      expect(result.current.entities).toEqual(mockEntities);
    });
    
    act(() => {
      result.current.updateFilters({
        dateRange: {
          start: new Date('2023-01-01T00:00:00Z'),
          end: new Date('2023-01-01T23:59:59Z'),
        },
      });
    });
    
    expect(result.current.filteredEntities).toEqual([mockEntities[0]]);
  });

  it('should combine multiple filters', async () => {
    const { result } = renderHook(() => useEntityManagement());
    
    await waitFor(() => {
      expect(result.current.entities).toEqual(mockEntities);
    });
    
    act(() => {
      result.current.updateFilters({
        search: 'Test',
        entityType: 'topic',
      });
    });
    
    expect(result.current.filteredEntities).toEqual([mockEntities[0]]);
  });

  it('should handle entity selection', async () => {
    const { result } = renderHook(() => useEntityManagement());
    
    await waitFor(() => {
      expect(result.current.entities).toEqual(mockEntities);
    });
    
    act(() => {
      result.current.selectEntity('0.0.12345', true);
    });
    
    expect(result.current.selectedEntities.has('0.0.12345')).toBe(true);
  });

  it('should handle entity deselection', async () => {
    const { result } = renderHook(() => useEntityManagement());
    
    await waitFor(() => {
      expect(result.current.entities).toEqual(mockEntities);
    });
    
    act(() => {
      result.current.selectEntity('0.0.12345', true);
    });
    
    expect(result.current.selectedEntities.has('0.0.12345')).toBe(true);
    
    act(() => {
      result.current.selectEntity('0.0.12345', false);
    });
    
    expect(result.current.selectedEntities.has('0.0.12345')).toBe(false);
  });

  it('should handle select all entities', async () => {
    const { result } = renderHook(() => useEntityManagement());
    
    await waitFor(() => {
      expect(result.current.entities).toEqual(mockEntities);
    });
    
    act(() => {
      result.current.selectAllEntities(true);
    });
    
    expect(result.current.selectedEntities.size).toBe(2);
    expect(result.current.selectedEntities.has('0.0.12345')).toBe(true);
    expect(result.current.selectedEntities.has('0.0.67890')).toBe(true);
  });

  it('should handle clear all selections', async () => {
    const { result } = renderHook(() => useEntityManagement());
    
    await waitFor(() => {
      expect(result.current.entities).toEqual(mockEntities);
    });
    
    act(() => {
      result.current.selectAllEntities(true);
    });
    
    expect(result.current.selectedEntities.size).toBe(2);
    
    act(() => {
      result.current.selectAllEntities(false);
    });
    
    expect(result.current.selectedEntities.size).toBe(0);
  });

  it('should handle entity deletion with optimistic updates', async () => {
    mockIpcRenderer.invoke.mockImplementation((channel: string, ..._args: unknown[]) => {
      if (channel === 'entity:getAll') {
        return Promise.resolve({ success: true, data: mockEntities });
      }
      if (channel === 'entity:delete') {
        return Promise.resolve({ success: true });
      }
      return Promise.resolve({ success: true });
    });
    
    const { result } = renderHook(() => useEntityManagement());
    
    await waitFor(() => {
      expect(result.current.entities).toEqual(mockEntities);
    });
    
    await act(async () => {
      await result.current.deleteEntity('0.0.12345');
    });
    
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('entity:delete', '0.0.12345');
    expect(result.current.entities).toEqual([mockEntities[1]]);
  });

  it('should handle entity deletion errors with rollback', async () => {
    mockIpcRenderer.invoke.mockImplementation((channel: string, ..._args: unknown[]) => {
      if (channel === 'entity:getAll') {
        return Promise.resolve({ success: true, data: mockEntities });
      }
      if (channel === 'entity:delete') {
        return Promise.resolve({ success: false, error: 'Deletion failed' });
      }
      return Promise.resolve({ success: true });
    });
    
    const { result } = renderHook(() => useEntityManagement());
    
    await waitFor(() => {
      expect(result.current.entities).toEqual(mockEntities);
    });
    
    await act(async () => {
      await result.current.deleteEntity('0.0.12345');
    });
    
    expect(result.current.error).toBe('Deletion failed');
    expect(result.current.entities).toEqual(mockEntities);
  });

  it('should handle bulk entity deletion', async () => {
    mockIpcRenderer.invoke.mockImplementation((channel: string, ..._args: unknown[]) => {
      if (channel === 'entity:getAll') {
        return Promise.resolve({ success: true, data: mockEntities });
      }
      if (channel === 'entity:bulkDelete') {
        return Promise.resolve({ success: true });
      }
      return Promise.resolve({ success: true });
    });
    
    const { result } = renderHook(() => useEntityManagement());
    
    await waitFor(() => {
      expect(result.current.entities).toEqual(mockEntities);
    });
    
    act(() => {
      result.current.selectAllEntities(true);
    });
    
    await act(async () => {
      await result.current.bulkDeleteEntities();
    });
    
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('entity:bulkDelete', ['0.0.12345', '0.0.67890']);
    expect(result.current.entities).toEqual([]);
    expect(result.current.selectedEntities.size).toBe(0);
  });

  it('should handle entity renaming', async () => {
    mockIpcRenderer.invoke.mockImplementation((channel: string, ..._args: unknown[]) => {
      if (channel === 'entity:getAll') {
        return Promise.resolve({ success: true, data: mockEntities });
      }
      if (channel === 'entity:rename') {
        return Promise.resolve({ success: true });
      }
      return Promise.resolve({ success: true });
    });
    
    const { result } = renderHook(() => useEntityManagement());
    
    await waitFor(() => {
      expect(result.current.entities).toEqual(mockEntities);
    });
    
    await act(async () => {
      await result.current.renameEntity('0.0.12345', 'Renamed Topic');
    });
    
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('entity:rename', '0.0.12345', 'Renamed Topic');
    
    const updatedEntity = result.current.entities.find(e => e.entityId === '0.0.12345');
    expect(updatedEntity?.entityName).toBe('Renamed Topic');
  });

  it('should handle export functionality', async () => {
    mockIpcRenderer.invoke.mockImplementation((channel: string, ..._args: unknown[]) => {
      if (channel === 'entity:getAll') {
        return Promise.resolve({ success: true, data: mockEntities });
      }
      if (channel === 'entity:export') {
        return Promise.resolve({ success: true, data: 'export-file-path' });
      }
      return Promise.resolve({ success: true });
    });
    
    const { result } = renderHook(() => useEntityManagement());
    
    await waitFor(() => {
      expect(result.current.entities).toEqual(mockEntities);
    });
    
    const exportResult = await act(async () => {
      return await result.current.exportEntities('json');
    });
    
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('entity:export', undefined, 'json');
    expect(exportResult).toBe('export-file-path');
  });

  it('should handle real-time entity updates', async () => {
    const { result } = renderHook(() => useEntityManagement());
    
    await waitFor(() => {
      expect(result.current.entities).toEqual(mockEntities);
    });
    
    expect(mockIpcRenderer.on).toHaveBeenCalledWith('entity:created', expect.any(Function));
    expect(mockIpcRenderer.on).toHaveBeenCalledWith('entity:deleted', expect.any(Function));
    expect(mockIpcRenderer.on).toHaveBeenCalledWith('entity:updated', expect.any(Function));
  });

  it('should cleanup event listeners on unmount', () => {
    const { unmount } = renderHook(() => useEntityManagement());
    
    unmount();
    
    expect(mockIpcRenderer.off).toHaveBeenCalledWith('entity:created', expect.any(Function));
    expect(mockIpcRenderer.off).toHaveBeenCalledWith('entity:deleted', expect.any(Function));
    expect(mockIpcRenderer.off).toHaveBeenCalledWith('entity:updated', expect.any(Function));
  });

  it('should handle entity creation events', async () => {
    const { result } = renderHook(() => useEntityManagement());
    
    await waitFor(() => {
      expect(result.current.entities).toEqual(mockEntities);
    });
    
    const onEntityCreatedCallback = mockIpcRenderer.on.mock.calls.find(
      call => call[0] === 'entity:created'
    )?.[1];
    
    const newEntity = {
      id: 3,
      entityId: '0.0.99999',
      entityName: 'New Entity',
      entityType: 'account',
      transactionId: '0.0.99999-123456789-000000002',
      sessionId: 'session-1',
      createdAt: new Date('2023-01-03T10:00:00Z'),
      updatedAt: new Date('2023-01-03T10:00:00Z'),
      isActive: true,
      metadata: null,
    };
    
    act(() => {
      onEntityCreatedCallback?.(null, newEntity);
    });
    
    expect(result.current.entities).toHaveLength(3);
    expect(result.current.entities).toContainEqual(newEntity);
  });

  it('should validate filter updates', async () => {
    const { result } = renderHook(() => useEntityManagement());
    
    await waitFor(() => {
      expect(result.current.entities).toEqual(mockEntities);
    });
    
    act(() => {
      result.current.updateFilters({
        dateRange: {
          start: new Date('2023-12-31'),
          end: new Date('2023-01-01'),
        },
      });
    });
    
    expect(result.current.error).toBe('End date must be after start date');
    expect(result.current.filters.dateRange).toEqual({ start: null, end: null });
  });

  it('should debounce filter updates to prevent excessive API calls', async () => {
    const { result } = renderHook(() => useEntityManagement());
    
    await waitFor(() => {
      expect(result.current.entities).toEqual(mockEntities);
    });
    
    act(() => {
      result.current.updateFilters({ search: 'a' });
      result.current.updateFilters({ search: 'ab' });
      result.current.updateFilters({ search: 'abc' });
    });
    
    expect(result.current.filters.search).toBe('abc');
    expect(mockIpcRenderer.invoke).toHaveBeenCalledTimes(1);
  });

  it('should handle network connectivity issues', async () => {
    mockIpcRenderer.invoke.mockImplementation((channel: string) => {
      if (channel === 'entity:getAll') {
        return Promise.reject(new Error('Network error'));
      }
      return Promise.resolve({ success: true });
    });
    
    const { result } = renderHook(() => useEntityManagement());
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe('Network error');
      expect(result.current.entities).toEqual([]);
    });
  });

  it('should provide retry functionality after errors', async () => {
    let callCount = 0;
    mockIpcRenderer.invoke.mockImplementation((channel: string) => {
      if (channel === 'entity:getAll') {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({ success: false, error: 'Temporary error' });
        }
        return Promise.resolve({ success: true, data: mockEntities });
      }
      return Promise.resolve({ success: true });
    });
    
    const { result } = renderHook(() => useEntityManagement());
    
    await waitFor(() => {
      expect(result.current.error).toBe('Temporary error');
    });
    
    await act(async () => {
      await result.current.retryLoad();
    });
    
    expect(result.current.error).toBe(null);
    expect(result.current.entities).toEqual(mockEntities);
  });
});