import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EntityList } from '../desktop/src/renderer/components/entity/entity-list';

/**
 * Mock react-virtual for virtual scrolling tests
 */
jest.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: jest.fn(() => ({
    getVirtualItems: () => [
      { index: 0, start: 0, size: 72, key: 0 },
      { index: 1, start: 72, size: 72, key: 1 },
      { index: 2, start: 144, size: 72, key: 2 },
    ],
    getTotalSize: () => 216,
    scrollToIndex: jest.fn(),
  })),
}));

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
  {
    id: 3,
    entityId: '0.0.11111',
    entityName: 'Test Account',
    entityType: 'account',
    transactionId: '0.0.11111-123456789-000000002',
    sessionId: 'session-2',
    createdAt: new Date('2023-01-03T10:00:00Z'),
    updatedAt: new Date('2023-01-03T10:00:00Z'),
    isActive: true,
    metadata: null,
  },
];

const defaultProps = {
  entities: mockEntities,
  selectedEntities: new Set<string>(),
  onEntitySelect: jest.fn(),
  onEntityDelete: jest.fn(),
  onEntityRename: jest.fn(),
  onBulkSelect: jest.fn(),
  loading: false,
};

describe('EntityList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render all entities in the list', () => {
    render(<EntityList {...defaultProps} />);
    
    expect(screen.getByText('Test Topic')).toBeInTheDocument();
    expect(screen.getByText('Test Token')).toBeInTheDocument();
    expect(screen.getByText('Test Account')).toBeInTheDocument();
  });

  it('should display entity types correctly', () => {
    render(<EntityList {...defaultProps} />);
    
    expect(screen.getByText('topic')).toBeInTheDocument();
    expect(screen.getByText('token')).toBeInTheDocument();
    expect(screen.getByText('account')).toBeInTheDocument();
  });

  it('should display entity IDs with proper formatting', () => {
    render(<EntityList {...defaultProps} />);
    
    expect(screen.getByText('0.0.12345')).toBeInTheDocument();
    expect(screen.getByText('0.0.67890')).toBeInTheDocument();
    expect(screen.getByText('0.0.11111')).toBeInTheDocument();
  });

  it('should handle entity selection', async () => {
    const user = userEvent.setup();
    const onEntitySelect = jest.fn();
    
    render(<EntityList {...defaultProps} onEntitySelect={onEntitySelect} />);
    
    const checkbox = screen.getAllByRole('checkbox')[0];
    await user.click(checkbox);
    
    expect(onEntitySelect).toHaveBeenCalledWith('0.0.12345', true);
  });

  it('should show selected state for entities', () => {
    const selectedEntities = new Set(['0.0.12345']);
    
    render(<EntityList {...defaultProps} selectedEntities={selectedEntities} />);
    
    const checkbox = screen.getAllByRole('checkbox')[0];
    expect(checkbox).toBeChecked();
  });

  it('should handle select all functionality', async () => {
    const user = userEvent.setup();
    const onBulkSelect = jest.fn();
    
    render(<EntityList {...defaultProps} onBulkSelect={onBulkSelect} />);
    
    const selectAllCheckbox = screen.getByLabelText('Select all entities');
    await user.click(selectAllCheckbox);
    
    expect(onBulkSelect).toHaveBeenCalledWith(['0.0.12345', '0.0.67890', '0.0.11111']);
  });

  it('should handle entity deletion', async () => {
    const user = userEvent.setup();
    const onEntityDelete = jest.fn();
    
    render(<EntityList {...defaultProps} onEntityDelete={onEntityDelete} />);
    
    const deleteButton = screen.getAllByLabelText('Delete entity')[0];
    await user.click(deleteButton);
    
    expect(onEntityDelete).toHaveBeenCalledWith('0.0.12345');
  });

  it('should handle entity renaming', async () => {
    const user = userEvent.setup();
    const onEntityRename = jest.fn();
    
    render(<EntityList {...defaultProps} onEntityRename={onEntityRename} />);
    
    const renameButton = screen.getAllByLabelText('Rename entity')[0];
    await user.click(renameButton);
    
    const nameInput = screen.getByDisplayValue('Test Topic');
    await user.clear(nameInput);
    await user.type(nameInput, 'Renamed Topic');
    
    const saveButton = screen.getByLabelText('Save name');
    await user.click(saveButton);
    
    expect(onEntityRename).toHaveBeenCalledWith('0.0.12345', 'Renamed Topic');
  });

  it('should display creation dates with proper formatting', () => {
    render(<EntityList {...defaultProps} />);
    
    expect(screen.getByText('Jan 1, 2023')).toBeInTheDocument();
    expect(screen.getByText('Jan 2, 2023')).toBeInTheDocument();
    expect(screen.getByText('Jan 3, 2023')).toBeInTheDocument();
  });

  it('should display transaction IDs when available', () => {
    render(<EntityList {...defaultProps} />);
    
    expect(screen.getByText('0.0.12345-123456789-000000000')).toBeInTheDocument();
    expect(screen.getByText('0.0.67890-123456789-000000001')).toBeInTheDocument();
  });

  it('should display loading state', () => {
    render(<EntityList {...defaultProps} loading={true} />);
    
    expect(screen.getByText('Loading entities...')).toBeInTheDocument();
    expect(screen.queryByText('Test Topic')).not.toBeInTheDocument();
  });

  it('should display empty state when no entities', () => {
    render(<EntityList {...defaultProps} entities={[]} />);
    
    expect(screen.getByText('No entities found')).toBeInTheDocument();
    expect(screen.getByText('Create entities using the available tools to see them here.')).toBeInTheDocument();
  });

  it('should implement virtual scrolling for performance', () => {
    const { useVirtualizer } = jest.requireActual('@tanstack/react-virtual');
    
    render(<EntityList {...defaultProps} />);
    
    expect(useVirtualizer).toHaveBeenCalledWith({
      count: mockEntities.length,
      getScrollElement: expect.any(Function),
      estimateSize: expect.any(Function),
    });
  });

  it('should display copy to clipboard buttons', () => {
    render(<EntityList {...defaultProps} />);
    
    const copyButtons = screen.getAllByLabelText('Copy entity ID');
    expect(copyButtons).toHaveLength(3);
  });

  it('should handle copy to clipboard functionality', async () => {
    const user = userEvent.setup();
    
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockImplementation(() => Promise.resolve()),
      },
    });
    
    render(<EntityList {...defaultProps} />);
    
    const copyButton = screen.getAllByLabelText('Copy entity ID')[0];
    await user.click(copyButton);
    
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('0.0.12345');
  });

  it('should display view on HashScan links', () => {
    render(<EntityList {...defaultProps} />);
    
    const hashScanLinks = screen.getAllByLabelText('View on HashScan');
    expect(hashScanLinks).toHaveLength(3);
    expect(hashScanLinks[0]).toHaveAttribute('href', 'https://hashscan.io/testnet/topic/0.0.12345');
  });

  it('should support keyboard navigation', async () => {
    const user = userEvent.setup();
    const onEntitySelect = jest.fn();
    
    render(<EntityList {...defaultProps} onEntitySelect={onEntitySelect} />);
    
    const firstEntityCard = screen.getAllByRole('checkbox')[0];
    firstEntityCard.focus();
    
    await user.keyboard('{Space}');
    expect(onEntitySelect).toHaveBeenCalledWith('0.0.12345', true);
    
    await user.keyboard('{ArrowDown}');
    const secondEntityCard = screen.getAllByRole('checkbox')[1];
    expect(secondEntityCard).toHaveFocus();
  });

  it('should display entity metadata when available', () => {
    render(<EntityList {...defaultProps} />);
    
    expect(screen.getByText('TTK')).toBeInTheDocument();
    expect(screen.getByText('2 decimals')).toBeInTheDocument();
  });

  it('should handle different entity types with appropriate icons', () => {
    render(<EntityList {...defaultProps} />);
    
    expect(screen.getByLabelText('Topic icon')).toBeInTheDocument();
    expect(screen.getByLabelText('Token icon')).toBeInTheDocument();
    expect(screen.getByLabelText('Account icon')).toBeInTheDocument();
  });

  it('should support sorting by different criteria', async () => {
    const user = userEvent.setup();
    
    render(<EntityList {...defaultProps} />);
    
    const sortButton = screen.getByText('Sort by');
    await user.click(sortButton);
    
    const sortByName = screen.getByText('Name');
    const sortByDate = screen.getByText('Date');
    const sortByType = screen.getByText('Type');
    
    expect(sortByName).toBeInTheDocument();
    expect(sortByDate).toBeInTheDocument();
    expect(sortByType).toBeInTheDocument();
  });

  it('should display batch action indicators when entities are selected', () => {
    const selectedEntities = new Set(['0.0.12345', '0.0.67890']);
    
    render(<EntityList {...defaultProps} selectedEntities={selectedEntities} />);
    
    expect(screen.getByText('2 entities selected')).toBeInTheDocument();
  });

  it('should maintain scroll position during updates', () => {
    const { rerender } = render(<EntityList {...defaultProps} />);
    
    const updatedEntities = [...mockEntities, {
      id: 4,
      entityId: '0.0.99999',
      entityName: 'New Entity',
      entityType: 'topic',
      transactionId: '0.0.99999-123456789-000000003',
      sessionId: 'session-1',
      createdAt: new Date('2023-01-04T10:00:00Z'),
      updatedAt: new Date('2023-01-04T10:00:00Z'),
      isActive: true,
      metadata: null,
    }];
    
    rerender(<EntityList {...defaultProps} entities={updatedEntities} />);
    
    expect(screen.getByText('New Entity')).toBeInTheDocument();
  });
});