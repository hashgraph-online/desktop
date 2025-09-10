import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MCPServerList } from '../../../src/renderer/components/mcp/MCPServerList';
import { factories } from '../../utils/testHelpers';

/**
 * Mock the MCPServerCard component to focus on MCPServerList logic
 */
jest.mock('../../../src/renderer/components/mcp/MCPServerCard', () => ({
  MCPServerCard: ({
    server,
    onToggle,
    onEdit,
    onDelete,
    onTest,
  }: {
    server: { id: string; name: string };
    onToggle: (id: string) => void;
    onEdit: (id: string) => void;
    onDelete: (id: string) => void;
    onTest: (id: string) => void;
  }) => (
    <div data-testid={`server-card-${server.id}`}>
      <span>{server.name}</span>
      <button
        onClick={() => onToggle(server.id)}
        data-testid={`toggle-${server.id}`}
      >
        Toggle
      </button>
      <button
        onClick={() => onEdit(server.id)}
        data-testid={`edit-${server.id}`}
      >
        Edit
      </button>
      <button
        onClick={() => onDelete(server.id)}
        data-testid={`delete-${server.id}`}
      >
        Delete
      </button>
      <button
        onClick={() => onTest(server.id)}
        data-testid={`test-${server.id}`}
      >
        Test
      </button>
    </div>
  ),
}));

describe('MCPServerList', () => {
  const mockHandlers = {
    onToggle: jest.fn(),
    onEdit: jest.fn(),
    onDelete: jest.fn(),
    onTest: jest.fn(),
    onAdd: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('loading state', () => {
    it('should display loading spinner when loading is true', () => {
      render(<MCPServerList servers={[]} loading={true} {...mockHandlers} />);

      expect(screen.getByText('Loading MCP servers...')).toBeInTheDocument();
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should not display server cards when loading', () => {
      const servers = [
        factories.mcpServer({ id: 'server-1', name: 'Test Server' }),
      ];

      render(
        <MCPServerList servers={servers} loading={true} {...mockHandlers} />
      );

      expect(
        screen.queryByTestId('server-card-server-1')
      ).not.toBeInTheDocument();
      expect(screen.getByText('Loading MCP servers...')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('should display empty state when no servers are configured', () => {
      render(<MCPServerList servers={[]} loading={false} {...mockHandlers} />);

      expect(screen.getByText('No servers configured')).toBeInTheDocument();
      expect(
        screen.getByText(/Add MCP servers to extend your agent/)
      ).toBeInTheDocument();
      expect(screen.getByText('Add Server')).toBeInTheDocument();
    });

    it('should call onAdd when "Add Server" button is clicked', () => {
      render(<MCPServerList servers={[]} loading={false} {...mockHandlers} />);

      const addButton = screen.getByText('Add Server');
      fireEvent.click(addButton);

      expect(mockHandlers.onAdd).toHaveBeenCalledTimes(1);
    });
  });

  describe('server list rendering', () => {
    it('should render all servers when provided', () => {
      const servers = [
        factories.mcpServer({ id: 'server-1', name: 'Server 1' }),
        factories.mcpServer({ id: 'server-2', name: 'Server 2' }),
        factories.mcpServer({ id: 'server-3', name: 'Server 3' }),
      ];

      render(
        <MCPServerList servers={servers} loading={false} {...mockHandlers} />
      );

      expect(screen.getByTestId('server-card-server-1')).toBeInTheDocument();
      expect(screen.getByTestId('server-card-server-2')).toBeInTheDocument();
      expect(screen.getByTestId('server-card-server-3')).toBeInTheDocument();

      expect(screen.getByText('Server 1')).toBeInTheDocument();
      expect(screen.getByText('Server 2')).toBeInTheDocument();
      expect(screen.getByText('Server 3')).toBeInTheDocument();
    });

    it('should pass all props to MCPServerCard components', () => {
      const servers = [
        factories.mcpServer({ id: 'server-1', name: 'Test Server' }),
      ];

      render(
        <MCPServerList servers={servers} loading={false} {...mockHandlers} />
      );

      const serverCard = screen.getByTestId('server-card-server-1');
      expect(serverCard).toBeInTheDocument();

      expect(screen.getByTestId('toggle-server-1')).toBeInTheDocument();
      expect(screen.getByTestId('edit-server-1')).toBeInTheDocument();
      expect(screen.getByTestId('delete-server-1')).toBeInTheDocument();
      expect(screen.getByTestId('test-server-1')).toBeInTheDocument();
    });
  });

  describe('event handling', () => {
    const servers = [
      factories.mcpServer({ id: 'server-1', name: 'Test Server' }),
    ];

    it('should handle toggle events', () => {
      render(
        <MCPServerList servers={servers} loading={false} {...mockHandlers} />
      );

      fireEvent.click(screen.getByTestId('toggle-server-1'));
      expect(mockHandlers.onToggle).toHaveBeenCalledWith('server-1');
    });

    it('should handle edit events', () => {
      render(
        <MCPServerList servers={servers} loading={false} {...mockHandlers} />
      );

      fireEvent.click(screen.getByTestId('edit-server-1'));
      expect(mockHandlers.onEdit).toHaveBeenCalledWith('server-1');
    });

    it('should handle delete events', () => {
      render(
        <MCPServerList servers={servers} loading={false} {...mockHandlers} />
      );

      fireEvent.click(screen.getByTestId('delete-server-1'));
      expect(mockHandlers.onDelete).toHaveBeenCalledWith('server-1');
    });

    it('should handle test events', () => {
      render(
        <MCPServerList servers={servers} loading={false} {...mockHandlers} />
      );

      fireEvent.click(screen.getByTestId('test-server-1'));
      expect(mockHandlers.onTest).toHaveBeenCalledWith('server-1');
    });
  });

  describe('default props', () => {
    it('should handle undefined loading prop', () => {
      render(<MCPServerList servers={[]} {...mockHandlers} />);

      expect(
        screen.queryByText('Loading MCP servers...')
      ).not.toBeInTheDocument();
      expect(screen.getByText('No servers configured')).toBeInTheDocument();
    });

    it('should handle missing optional handlers gracefully', () => {
      const servers = [
        factories.mcpServer({ id: 'server-1', name: 'Test Server' }),
      ];

      expect(() => {
        render(
          <MCPServerList
            servers={servers}
            loading={false}
            onToggle={mockHandlers.onToggle}
            onAdd={mockHandlers.onAdd}
          />
        );
      }).not.toThrow();
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA labels for loading state', () => {
      render(<MCPServerList servers={[]} loading={true} {...mockHandlers} />);

      const spinner = screen.getByRole('status');
      expect(spinner).toBeInTheDocument();
    });

    it('should have proper button roles in empty state', () => {
      render(<MCPServerList servers={[]} loading={false} {...mockHandlers} />);

      const addButton = screen.getByRole('button', { name: /Add Server/i });
      expect(addButton).toBeInTheDocument();
    });
  });

  describe('grid layout', () => {
    it('should use grid layout for server cards', () => {
      const servers = [
        factories.mcpServer({ id: 'server-1', name: 'Server 1' }),
        factories.mcpServer({ id: 'server-2', name: 'Server 2' }),
      ];

      const { container } = render(
        <MCPServerList servers={servers} loading={false} {...mockHandlers} />
      );

      const gridContainer = container.querySelector('.grid');
      expect(gridContainer).toBeInTheDocument();
      expect(gridContainer).toHaveClass('gap-4');
    });
  });

  describe('server statistics', () => {
    it('should handle servers with tools', () => {
      const servers = [
        factories.mcpServer({
          id: 'server-1',
          name: 'Server 1',
          status: 'connected',
          enabled: true,
          tools: [
            { name: 'tool1', description: 'Tool 1' },
            { name: 'tool2', description: 'Tool 2' },
          ],
        }),
        factories.mcpServer({
          id: 'server-2',
          name: 'Server 2',
          status: 'disconnected',
          enabled: false,
          tools: [],
        }),
      ];

      render(
        <MCPServerList servers={servers} loading={false} {...mockHandlers} />
      );

      expect(screen.getByTestId('server-card-server-1')).toBeInTheDocument();
      expect(screen.getByTestId('server-card-server-2')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle servers with missing properties', () => {
      const servers = [
        {
          id: 'server-1',
          name: 'Minimal Server',
        },
      ] as { id: string; name: string }[];

      expect(() => {
        render(
          <MCPServerList servers={servers} loading={false} {...mockHandlers} />
        );
      }).not.toThrow();

      expect(screen.getByTestId('server-card-server-1')).toBeInTheDocument();
    });

    it('should handle very long server lists', () => {
      const servers = Array.from({ length: 50 }, (_, i) =>
        factories.mcpServer({
          id: `server-${i}`,
          name: `Server ${i}`,
        })
      );

      const { container } = render(
        <MCPServerList servers={servers} loading={false} {...mockHandlers} />
      );

      expect(
        container.querySelectorAll('[data-testid^="server-card-"]')
      ).toHaveLength(50);
    });
  });
});
