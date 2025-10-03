import React, { useState, useEffect, useCallback } from 'react';
import { 
  FiLink, 
  FiUsers, 
  FiClock,
  FiCheck,
  FiX,
  FiMessageCircle,
  FiRefreshCw,
  FiUser
} from 'react-icons/fi';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../components/ui/Card';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Skeleton } from '../components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { ScrollArea } from '../components/ui/scroll-area';
import Typography from '../components/ui/Typography';

interface Connection {
  id: string;
  accountId: string;
  profile?: any;
  status: 'pending' | 'accepted' | 'rejected';
  direction: 'incoming' | 'outgoing';
  createdAt: Date;
  updatedAt?: Date;
  topicId?: string;
}

const ConnectionsPage: React.FC = () => {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'accepted'>('all');

  /**
   * Loads connections from the backend
   */
  const loadConnections = useCallback(async () => {
    try {
      setIsLoading(true);
      
      const result = await window.api.invoke('hcs10_get_connections');

      if (result.success) {
        setConnections(result.data || []);
      } else {
        toast.error('Failed to Load Connections', {
          description: result.error || 'Could not retrieve connections',
        });
      }
    } catch (error) {
      toast.error('Error', {
        description: 'Failed to connect to connection service',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Accepts a connection request
   */
  const handleAccept = useCallback(async (connectionId: string) => {
    try {
      const result = await window.api.invoke('hcs10_accept_connection', {
        connectionId,
      });

      if (result.success) {
        toast.success('Connection Accepted', {
          description: 'You are now connected with this agent',
        });
        loadConnections();
      } else {
        toast.error('Failed to Accept', {
          description: result.error || 'Could not accept connection',
        });
      }
    } catch (error) {
      toast.error('Error', {
        description: 'Failed to accept connection',
      });
    }
  }, [loadConnections]);

  /**
   * Rejects a connection request
   */
  const handleReject = useCallback(async (connectionId: string) => {
    try {
      const result = await window.api.invoke('hcs10_reject_connection', {
        connectionId,
      });

      if (result.success) {
        toast.success('Connection Rejected', {
          description: 'The connection request has been rejected',
        });
        loadConnections();
      } else {
        toast.error('Failed to Reject', {
          description: result.error || 'Could not reject connection',
        });
      }
    } catch (error) {
      toast.error('Error', {
        description: 'Failed to reject connection',
      });
    }
  }, [loadConnections]);

  /**
   * Starts a chat with a connected agent
   */
  const handleStartChat = useCallback((accountId: string) => {
    window.location.href = `#/chat/${accountId}`;
  }, []);

  const handleDiscoverAgents = () => {
    window.location.href = '#/discover';
  };

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  /**
   * Filters connections based on active tab
   */
  const filteredConnections = connections.filter((conn) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pending') return conn.status === 'pending';
    if (activeTab === 'accepted') return conn.status === 'accepted';
    return true;
  });

  /**
   * Gets statistics for connections
   */
  const stats = {
    total: connections.length,
    pending: connections.filter((c) => c.status === 'pending').length,
    accepted: connections.filter((c) => c.status === 'accepted').length,
    incoming: connections.filter((c) => c.direction === 'incoming' && c.status === 'pending').length,
  };

  const ConnectionSkeleton: React.FC = () => (
    <Card>
      <CardHeader>
        <div className="flex items-center space-x-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-full" />
      </CardContent>
      <CardFooter>
        <Skeleton className="h-9 w-24" />
      </CardFooter>
    </Card>
  );

  interface ConnectionCardProps {
    connection: Connection;
    onAccept: (connectionId: string) => void;
    onReject: (connectionId: string) => void;
    onStartChat: (accountId: string) => void;
  }

  const ConnectionCard: React.FC<ConnectionCardProps> = ({ 
    connection, 
    onAccept, 
    onReject, 
    onStartChat 
  }) => {
    const displayName = connection.profile?.display_name || `Account ${connection.accountId?.split('.').pop() || 'Unknown'}`;
    const bio = connection.profile?.bio;

    const handleAcceptClick = () => onAccept(connection.id);
    const handleRejectClick = () => onReject(connection.id);
    const handleStartChatClick = () => onStartChat(connection.accountId);

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-3">
            <Avatar>
              <AvatarImage src={connection.profile?.profileImage} />
              <AvatarFallback>
                {displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <Typography variant="h3" className="font-semibold">{displayName}</Typography>
              <p className="text-sm text-muted-foreground">{connection.accountId}</p>
            </div>
          </div>
        </CardHeader>
        {bio && (
          <CardContent>
            <p className="text-sm text-muted-foreground line-clamp-2">{bio}</p>
          </CardContent>
        )}
        <CardFooter className="flex justify-between">
          <div className="text-xs text-muted-foreground">
            {connection.direction === 'incoming' ? (
              <span className="flex items-center">
                <FiUsers className="mr-1 h-3 w-3" />
                Incoming request
              </span>
            ) : (
              <span className="flex items-center">
                <FiLink className="mr-1 h-3 w-3" />
                Outgoing request
              </span>
            )}
          </div>
          <div className="flex space-x-2">
            {connection.status === 'pending' && connection.direction === 'incoming' && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRejectClick}
                >
                  <FiX className="mr-1 h-4 w-4" />
                  Reject
                </Button>
                <Button
                  size="sm"
                  onClick={handleAcceptClick}
                >
                  <FiCheck className="mr-1 h-4 w-4" />
                  Accept
                </Button>
              </>
            )}
            {connection.status === 'accepted' && (
              <Button
                size="sm"
                onClick={handleStartChatClick}
              >
                <FiMessageCircle className="mr-1 h-4 w-4" />
                Chat
              </Button>
            )}
            {connection.status === 'pending' && connection.direction === 'outgoing' && (
              <span className="flex items-center text-xs text-muted-foreground">
                <FiClock className="mr-1 h-3 w-3" />
                Waiting for response
              </span>
            )}
          </div>
        </CardFooter>
      </Card>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between mb-4">
          <div>
            <Typography variant="h1" className="text-2xl font-bold">Connections</Typography>
            <p className="text-muted-foreground">
              Manage your agent connections and requests
            </p>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={loadConnections}
            disabled={isLoading}
          >
            <FiRefreshCw className={isLoading ? 'animate-spin' : ''} />
          </Button>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <FiLink className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Connected</p>
                  <p className="text-2xl font-bold">{stats.accepted}</p>
                </div>
                <FiCheck className="h-8 w-8 text-hgo-green" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                </div>
                <FiClock className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">New Requests</p>
                  <p className="text-2xl font-bold">{stats.incoming}</p>
                </div>
                <FiUsers className="h-8 w-8 text-hgo-blue" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList>
            <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
            <TabsTrigger value="pending">
              Pending ({stats.pending})
              {stats.incoming > 0 && (
                <Badge variant="default" className="ml-2">
                  {stats.incoming}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="accepted">Connected ({stats.accepted})</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <ScrollArea className="flex-1 p-6">
        {isLoading ? (
          <div className="grid gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <ConnectionSkeleton key={i} />
            ))}
          </div>
        ) : filteredConnections.length > 0 ? (
          <div className="grid gap-4">
            {filteredConnections.map((connection) => (
              <ConnectionCard 
                key={connection.id} 
                connection={connection}
                onAccept={handleAccept}
                onReject={handleReject}
                onStartChat={handleStartChat}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64">
            <FiLink className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No connections yet</p>
            <p className="text-muted-foreground mb-4">
              {activeTab === 'pending'
                ? 'No pending connection requests'
                : activeTab === 'accepted'
                ? 'No accepted connections yet'
                : 'Start discovering agents to make connections'}
            </p>
            <Button onClick={handleDiscoverAgents}>
              Discover Agents
            </Button>
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default ConnectionsPage;
