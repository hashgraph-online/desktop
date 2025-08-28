import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EntityCard } from '../desktop/src/renderer/components/entity/entity-card';

/**
 * Test entity data
 */
const mockEntity = {
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
};

const mockTokenEntity = {
  id: 2,
  entityId: '0.0.67890',
  entityName: 'Test Token',
  entityType: 'token',
  transactionId: '0.0.67890-123456789-000000001',
  sessionId: 'session-1',
  createdAt: new Date('2023-01-02T10:00:00Z'),
  updatedAt: new Date('2023-01-02T10:00:00Z'),
  isActive: true,
  metadata: '{"symbol":"TTK","decimals":2,"totalSupply":"1000000"}',
};

const defaultProps = {
  entity: mockEntity,
  isSelected: false,
  onSelect: jest.fn(),
  onDelete: jest.fn(),
  onRename: jest.fn(),
  onCopyToClipboard: jest.fn(),
};

describe('EntityCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockImplementation(() => Promise.resolve()),
      },
    });
  });

  it('should render entity information correctly', () => {
    render(<EntityCard {...defaultProps} />);
    
    expect(screen.getByText('Test Topic')).toBeInTheDocument();
    expect(screen.getByText('0.0.12345')).toBeInTheDocument();
    expect(screen.getByText('topic')).toBeInTheDocument();
    expect(screen.getByText('Jan 1, 2023')).toBeInTheDocument();
  });

  it('should display transaction ID when available', () => {
    render(<EntityCard {...defaultProps} />);
    
    expect(screen.getByText('0.0.12345-123456789-000000000')).toBeInTheDocument();
  });

  it('should handle entity selection', async () => {
    const user = userEvent.setup();
    const onSelect = jest.fn();
    
    render(<EntityCard {...defaultProps} onSelect={onSelect} />);
    
    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);
    
    expect(onSelect).toHaveBeenCalledWith(true);
  });

  it('should show selected state correctly', () => {
    render(<EntityCard {...defaultProps} isSelected={true} />);
    
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
  });

  it('should handle entity deletion', async () => {
    const user = userEvent.setup();
    const onDelete = jest.fn();
    
    render(<EntityCard {...defaultProps} onDelete={onDelete} />);
    
    const deleteButton = screen.getByLabelText('Delete entity');
    await user.click(deleteButton);
    
    const confirmButton = screen.getByText('Delete');
    await user.click(confirmButton);
    
    expect(onDelete).toHaveBeenCalled();
  });

  it('should handle entity renaming', async () => {
    const user = userEvent.setup();
    const onRename = jest.fn();
    
    render(<EntityCard {...defaultProps} onRename={onRename} />);
    
    const renameButton = screen.getByLabelText('Rename entity');
    await user.click(renameButton);
    
    const nameInput = screen.getByDisplayValue('Test Topic');
    await user.clear(nameInput);
    await user.type(nameInput, 'Renamed Topic');
    
    const saveButton = screen.getByLabelText('Save name');
    await user.click(saveButton);
    
    expect(onRename).toHaveBeenCalledWith('Renamed Topic');
  });

  it('should handle copy to clipboard', async () => {
    const user = userEvent.setup();
    const onCopyToClipboard = jest.fn();
    
    render(<EntityCard {...defaultProps} onCopyToClipboard={onCopyToClipboard} />);
    
    const copyButton = screen.getByLabelText('Copy entity ID');
    await user.click(copyButton);
    
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('0.0.12345');
    expect(onCopyToClipboard).toHaveBeenCalled();
  });

  it('should display appropriate icon for entity type', () => {
    render(<EntityCard {...defaultProps} />);
    
    expect(screen.getByLabelText('Topic icon')).toBeInTheDocument();
  });

  it('should display token icon for token entities', () => {
    render(<EntityCard {...defaultProps} entity={mockTokenEntity} />);
    
    expect(screen.getByLabelText('Token icon')).toBeInTheDocument();
  });

  it('should parse and display metadata for tokens', () => {
    render(<EntityCard {...defaultProps} entity={mockTokenEntity} />);
    
    expect(screen.getByText('TTK')).toBeInTheDocument();
    expect(screen.getByText('2 decimals')).toBeInTheDocument();
    expect(screen.getByText('1,000,000 total supply')).toBeInTheDocument();
  });

  it('should handle malformed metadata gracefully', () => {
    const entityWithBadMetadata = {
      ...mockTokenEntity,
      metadata: 'invalid-json',
    };
    
    render(<EntityCard {...defaultProps} entity={entityWithBadMetadata} />);
    
    expect(screen.getByText('Test Token')).toBeInTheDocument();
    expect(screen.queryByText('TTK')).not.toBeInTheDocument();
  });

  it('should display HashScan link', () => {
    render(<EntityCard {...defaultProps} />);
    
    const hashScanLink = screen.getByLabelText('View on HashScan');
    expect(hashScanLink).toHaveAttribute('href', 'https://hashscan.io/testnet/topic/0.0.12345');
    expect(hashScanLink).toHaveAttribute('target', '_blank');
  });

  it('should display correct HashScan URL for different entity types', () => {
    render(<EntityCard {...defaultProps} entity={mockTokenEntity} />);
    
    const hashScanLink = screen.getByLabelText('View on HashScan');
    expect(hashScanLink).toHaveAttribute('href', 'https://hashscan.io/testnet/token/0.0.67890');
  });

  it('should show loading state during operations', async () => {
    const user = userEvent.setup();
    const onDelete = jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    
    render(<EntityCard {...defaultProps} onDelete={onDelete} />);
    
    const deleteButton = screen.getByLabelText('Delete entity');
    await user.click(deleteButton);
    
    const confirmButton = screen.getByText('Delete');
    await user.click(confirmButton);
    
    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.queryByLabelText('Loading')).not.toBeInTheDocument();
    });
  });

  it('should cancel rename operation', async () => {
    const user = userEvent.setup();
    const onRename = jest.fn();
    
    render(<EntityCard {...defaultProps} onRename={onRename} />);
    
    const renameButton = screen.getByLabelText('Rename entity');
    await user.click(renameButton);
    
    const nameInput = screen.getByDisplayValue('Test Topic');
    await user.clear(nameInput);
    await user.type(nameInput, 'Renamed Topic');
    
    const cancelButton = screen.getByLabelText('Cancel rename');
    await user.click(cancelButton);
    
    expect(onRename).not.toHaveBeenCalled();
    expect(screen.getByText('Test Topic')).toBeInTheDocument();
  });

  it('should validate entity name during rename', async () => {
    const user = userEvent.setup();
    const onRename = jest.fn();
    
    render(<EntityCard {...defaultProps} onRename={onRename} />);
    
    const renameButton = screen.getByLabelText('Rename entity');
    await user.click(renameButton);
    
    const nameInput = screen.getByDisplayValue('Test Topic');
    await user.clear(nameInput);
    
    const saveButton = screen.getByLabelText('Save name');
    await user.click(saveButton);
    
    expect(screen.getByText('Name cannot be empty')).toBeInTheDocument();
    expect(onRename).not.toHaveBeenCalled();
  });

  it('should display custom style when provided', () => {
    const customStyle = { backgroundColor: 'red' };
    const { container } = render(<EntityCard {...defaultProps} style={customStyle} />);
    
    const cardElement = container.firstChild as HTMLElement;
    expect(cardElement).toHaveStyle('background-color: red');
  });

  it('should support keyboard navigation', async () => {
    const user = userEvent.setup();
    const onSelect = jest.fn();
    
    render(<EntityCard {...defaultProps} onSelect={onSelect} />);
    
    const checkbox = screen.getByRole('checkbox');
    checkbox.focus();
    
    await user.keyboard('{Space}');
    expect(onSelect).toHaveBeenCalledWith(true);
  });

  it('should handle keyboard shortcuts for actions', async () => {
    const user = userEvent.setup();
    const onDelete = jest.fn();
    const onRename = jest.fn();
    
    render(<EntityCard {...defaultProps} onDelete={onDelete} onRename={onRename} />);
    
    const cardElement = screen.getByRole('article');
    cardElement.focus();
    
    await user.keyboard('{Delete}');
    expect(screen.getByText('Are you sure you want to delete this entity?')).toBeInTheDocument();
    
    const confirmButton = screen.getByText('Delete');
    await user.click(confirmButton);
    expect(onDelete).toHaveBeenCalled();
  });

  it('should display session information when available', () => {
    render(<EntityCard {...defaultProps} />);
    
    expect(screen.getByText('session-1')).toBeInTheDocument();
  });

  it('should handle entities without session ID', () => {
    const entityWithoutSession = {
      ...mockEntity,
      sessionId: null,
    };
    
    render(<EntityCard {...defaultProps} entity={entityWithoutSession} />);
    
    expect(screen.getByText('Test Topic')).toBeInTheDocument();
    expect(screen.getByText('No session')).toBeInTheDocument();
  });

  it('should display creation time with relative formatting', () => {
    const recentEntity = {
      ...mockEntity,
      createdAt: new Date(Date.now() - 60000), // 1 minute ago
    };
    
    render(<EntityCard {...defaultProps} entity={recentEntity} />);
    
    expect(screen.getByText('1 minute ago')).toBeInTheDocument();
  });

  it('should handle entity card hover effects', async () => {
    const user = userEvent.setup();
    
    render(<EntityCard {...defaultProps} />);
    
    const cardElement = screen.getByRole('article');
    
    await user.hover(cardElement);
    
    expect(cardElement).toHaveClass('hover:shadow-lg');
  });

  it('should display appropriate badges for different entity states', () => {
    const inactiveEntity = {
      ...mockEntity,
      isActive: false,
    };
    
    render(<EntityCard {...defaultProps} entity={inactiveEntity} />);
    
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('should truncate long entity names appropriately', () => {
    const longNameEntity = {
      ...mockEntity,
      entityName: 'This is a very long entity name that should be truncated for display purposes',
    };
    
    render(<EntityCard {...defaultProps} entity={longNameEntity} />);
    
    const nameElement = screen.getByText('This is a very long entity name that should be truncated for display purposes');
    expect(nameElement).toHaveClass('truncate');
  });
});