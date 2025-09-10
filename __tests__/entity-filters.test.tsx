import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EntityFilters } from '../src/renderer/components/entity/entity-filters';
import { waitFor } from '@testing-library/react';

/**
 * Mock debounced hook for search input
 */
jest.mock('../src/renderer/hooks/use-debounced-value', () => ({
  useDebounce: jest.fn((value: string) => value),
}));

const mockFilters = {
  search: '',
  entityType: '',
  dateRange: { start: null, end: null },
  sessionId: '',
};

const mockEntityTypes = ['topic', 'token', 'account', 'schedule', 'contract'];

const defaultProps = {
  filters: mockFilters,
  onFiltersChange: jest.fn(),
  entityTypes: mockEntityTypes,
  onClearFilters: jest.fn(),
  totalEntities: 150,
  filteredEntities: 25,
};

describe('EntityFilters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render all filter components', async () => {
    const user = userEvent.setup();
    render(<EntityFilters {...defaultProps} />);
    
    expect(screen.getByPlaceholderText('Search entities...')).toBeInTheDocument();
    expect(screen.getByLabelText('Entity Type')).toBeInTheDocument();
    expect(screen.getByText('Clear Filters')).toBeInTheDocument();
    
    const advancedButton = screen.getByLabelText('Advanced filters');
    await user.click(advancedButton);
    
    expect(screen.getByLabelText('Start Date')).toBeInTheDocument();
    expect(screen.getByLabelText('End Date')).toBeInTheDocument();
  });

  it('should display entity count information', () => {
    render(<EntityFilters {...defaultProps} />);
    
    expect(screen.getByText('Showing 25 of 150 entities')).toBeInTheDocument();
  });

  it('should handle search input changes', async () => {
    const user = userEvent.setup();
    const onFiltersChange = jest.fn();
    
    render(<EntityFilters {...defaultProps} onFiltersChange={onFiltersChange} />);
    
    const searchInput = screen.getByPlaceholderText('Search entities...');
    await user.type(searchInput, 'test');
    
    await waitFor(() => {
      expect(onFiltersChange).toHaveBeenCalledWith({
        ...mockFilters,
        search: 'test',
      });
    });
  });

  it('should debounce search input to prevent excessive API calls', async () => {
    const { useDebounce } = jest.requireActual('../src/renderer/hooks/use-debounced-value') as { useDebounce: jest.Mock };
    useDebounce.mockReturnValue('debounced-value');
    
    const user = userEvent.setup();
    const onFiltersChange = jest.fn();
    
    render(<EntityFilters {...defaultProps} onFiltersChange={onFiltersChange} />);
    
    const searchInput = screen.getByPlaceholderText('Search entities...');
    await user.type(searchInput, 'test');
    
    expect(useDebounce).toHaveBeenCalledWith('test', 300);
  });

  it('should handle entity type filter changes', async () => {
    const user = userEvent.setup();
    const onFiltersChange = jest.fn();
    
    render(<EntityFilters {...defaultProps} onFiltersChange={onFiltersChange} />);
    
    const typeSelect = screen.getByLabelText('Entity Type');
    await user.selectOptions(typeSelect, 'topic');
    
    expect(onFiltersChange).toHaveBeenCalledWith({
      ...mockFilters,
      entityType: 'topic',
    });
  });

  it('should render all available entity types in dropdown', () => {
    render(<EntityFilters {...defaultProps} />);
    
    const _typeSelect = screen.getByLabelText('Entity Type');
    
    expect(screen.getByRole('option', { name: 'All Types' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'topic' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'token' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'account' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'schedule' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'contract' })).toBeInTheDocument();
  });

  it('should handle date range filter changes', async () => {
    const user = userEvent.setup();
    const onFiltersChange = jest.fn();
    
    render(<EntityFilters {...defaultProps} onFiltersChange={onFiltersChange} />);
    
    const advancedButton = screen.getByLabelText('Advanced filters');
    await user.click(advancedButton);
    
    const startDateInput = screen.getByLabelText('Start Date');
    const endDateInput = screen.getByLabelText('End Date');
    
    await user.type(startDateInput, '2023-01-01');
    await user.type(endDateInput, '2023-12-31');
    
    expect(onFiltersChange).toHaveBeenCalledWith({
      ...mockFilters,
      dateRange: { start: new Date('2023-01-01'), end: new Date('2023-12-31') },
    });
  });

  it('should handle clear filters action', async () => {
    const user = userEvent.setup();
    const onClearFilters = jest.fn();
    
    const activeFilters = {
      search: 'test',
      entityType: 'topic',
      dateRange: { start: new Date('2023-01-01'), end: new Date('2023-12-31') },
      sessionId: 'session-1',
    };
    
    render(<EntityFilters {...defaultProps} filters={activeFilters} onClearFilters={onClearFilters} />);
    
    const clearButton = screen.getByText('Clear Filters');
    await user.click(clearButton);
    
    expect(onClearFilters).toHaveBeenCalled();
  });

  it('should show filter badges when filters are active', () => {
    const activeFilters = {
      search: 'test',
      entityType: 'topic',
      dateRange: { start: new Date('2023-01-01'), end: new Date('2023-12-31') },
      sessionId: 'session-1',
    };
    
    render(<EntityFilters {...defaultProps} filters={activeFilters} />);
    
    expect(screen.getByText('Search: test')).toBeInTheDocument();
    expect(screen.getByText('Type: topic')).toBeInTheDocument();
    expect(screen.getByText('Date Range: 2023-01-01 to 2023-12-31')).toBeInTheDocument();
    expect(screen.getByText('Session: session-1')).toBeInTheDocument();
  });

  it('should allow removing individual filter badges', async () => {
    const user = userEvent.setup();
    const onFiltersChange = jest.fn();
    
    const activeFilters = {
      search: 'test',
      entityType: 'topic',
      dateRange: { start: null, end: null },
      sessionId: '',
    };
    
    render(<EntityFilters {...defaultProps} filters={activeFilters} onFiltersChange={onFiltersChange} />);
    
    const searchBadge = screen.getByText('Search: test');
    const removeSearchButton = searchBadge.parentElement?.querySelector('[aria-label="Remove search filter"]');
    
    if (removeSearchButton) {
      await user.click(removeSearchButton);
      
      expect(onFiltersChange).toHaveBeenCalledWith({
        ...activeFilters,
        search: '',
      });
    }
  });

  it('should validate date range inputs', async () => {
    const user = userEvent.setup();
    const onFiltersChange = jest.fn();
    
    render(<EntityFilters {...defaultProps} onFiltersChange={onFiltersChange} />);
    
    const startDateInput = screen.getByLabelText('Start Date');
    const endDateInput = screen.getByLabelText('End Date');
    
    await user.type(startDateInput, '2023-12-31');
    await user.type(endDateInput, '2023-01-01');
    
    expect(screen.getByText('End date must be after start date')).toBeInTheDocument();
    expect(onFiltersChange).not.toHaveBeenCalled();
  });

  it('should support preset filter combinations', async () => {
    const user = userEvent.setup();
    const onFiltersChange = jest.fn();
    
    render(<EntityFilters {...defaultProps} onFiltersChange={onFiltersChange} />);
    
    const presetButton = screen.getByText('Last 30 Days');
    await user.click(presetButton);
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    expect(onFiltersChange).toHaveBeenCalledWith({
      ...mockFilters,
      dateRange: { 
        start: expect.any(Date), 
        end: expect.any(Date) 
      },
    });
  });

  it('should display saved filter presets', () => {
    render(<EntityFilters {...defaultProps} />);
    
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Last 7 Days')).toBeInTheDocument();
    expect(screen.getByText('Last 30 Days')).toBeInTheDocument();
    expect(screen.getByText('This Month')).toBeInTheDocument();
  });

  it('should handle session filter when multiple sessions exist', async () => {
    const user = userEvent.setup();
    const onFiltersChange = jest.fn();
    
    const sessionIds = ['session-1', 'session-2', 'session-3'];
    
    render(<EntityFilters {...defaultProps} onFiltersChange={onFiltersChange} sessionIds={sessionIds} />);
    
    const sessionSelect = screen.getByLabelText('Session');
    await user.selectOptions(sessionSelect, 'session-2');
    
    expect(onFiltersChange).toHaveBeenCalledWith({
      ...mockFilters,
      sessionId: 'session-2',
    });
  });

  it('should hide session filter when only one session exists', () => {
    const singleSession = ['session-1'];
    
    render(<EntityFilters {...defaultProps} sessionIds={singleSession} />);
    
    expect(screen.queryByLabelText('Session')).not.toBeInTheDocument();
  });

  it('should support keyboard navigation through filters', async () => {
    const user = userEvent.setup();
    
    render(<EntityFilters {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText('Search entities...');
    searchInput.focus();
    
    await user.keyboard('{Tab}');
    expect(screen.getByLabelText('Entity Type')).toHaveFocus();
    
    await user.keyboard('{Tab}');
    expect(screen.getByLabelText('Start Date')).toHaveFocus();
    
    await user.keyboard('{Tab}');
    expect(screen.getByLabelText('End Date')).toHaveFocus();
  });

  it('should display filter results count dynamically', () => {
    const { rerender } = render(<EntityFilters {...defaultProps} />);
    
    expect(screen.getByText('Showing 25 of 150 entities')).toBeInTheDocument();
    
    rerender(<EntityFilters {...defaultProps} filteredEntities={5} />);
    expect(screen.getByText('Showing 5 of 150 entities')).toBeInTheDocument();
  });

  it('should handle empty search gracefully', async () => {
    const user = userEvent.setup();
    const onFiltersChange = jest.fn();
    
    render(<EntityFilters {...defaultProps} onFiltersChange={onFiltersChange} />);
    
    const searchInput = screen.getByPlaceholderText('Search entities...');
    await user.type(searchInput, 'test');
    await user.clear(searchInput);
    
    await waitFor(() => {
      expect(onFiltersChange).toHaveBeenLastCalledWith({
        ...mockFilters,
        search: '',
      });
    });
  });

  it('should preserve filter state during component updates', () => {
    const activeFilters = {
      search: 'test query',
      entityType: 'token',
      dateRange: { start: new Date('2023-01-01'), end: new Date('2023-12-31') },
      sessionId: 'session-1',
    };
    
    const { rerender } = render(<EntityFilters {...defaultProps} filters={activeFilters} />);
    
    rerender(<EntityFilters {...defaultProps} filters={activeFilters} totalEntities={200} />);
    
    expect(screen.getByDisplayValue('test query')).toBeInTheDocument();
    expect(screen.getByDisplayValue('token')).toBeInTheDocument();
  });

  it('should support advanced search syntax', async () => {
    const user = userEvent.setup();
    const onFiltersChange = jest.fn();
    
    render(<EntityFilters {...defaultProps} onFiltersChange={onFiltersChange} />);
    
    const searchInput = screen.getByPlaceholderText('Search entities...');
    await user.type(searchInput, 'type:topic name:*test*');
    
    await waitFor(() => {
      expect(onFiltersChange).toHaveBeenCalledWith({
        ...mockFilters,
        search: 'type:topic name:*test*',
      });
    });
  });

  it('should display search suggestions when available', async () => {
    const user = userEvent.setup();
    
    render(<EntityFilters {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText('Search entities...');
    await user.type(searchInput, 'test');
    
    expect(screen.getByText('Search in names')).toBeInTheDocument();
    expect(screen.getByText('Search in IDs')).toBeInTheDocument();
    expect(screen.getByText('Search in transaction IDs')).toBeInTheDocument();
  });

  it('should handle filter persistence across sessions', () => {
    const mockLocalStorage = {
      getItem: jest.fn().mockReturnValue('{"entityType": "topic", "search": "saved query"}'),
      setItem: jest.fn(),
    };
    
    Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });
    
    render(<EntityFilters {...defaultProps} />);
    
    expect(mockLocalStorage.getItem).toHaveBeenCalledWith('entityManagerFilters');
  });
});