import React, { useState, useEffect } from 'react';
import { 
  HiBolt,
  HiPlus,
  HiPencil,
  HiTrash,
  HiGlobeAlt,
  HiCurrencyDollar,
  HiDocumentText
} from 'react-icons/hi2';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/Card';
import { Button } from '../../../ui/Button';
import Typography from '../../../ui/Typography';
import { ScrollArea } from '../../../ui/scroll-area';
import { useBlockTesterStore } from '../../../../stores/blockTesterStore';
import { cn } from '../../../../lib/utils';

interface ActionEditorProps {
  actions: Record<string, any>;
  onChange: (actions: Record<string, any>) => void;
  className?: string;
}

interface ActionBinding {
  id: string;
  type: string;
  label: string;
  description?: string;
  parameters: Record<string, any>;
  triggers: string[];
  enabled: boolean;
}

interface ActionDefinition {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  category: 'hedera' | 'web3' | 'custom';
  parameters: {
    name: string;
    type: string;
    required: boolean;
    description: string;
    defaultValue?: any;
  }[];
}

interface ActionFormProps {
  actionId: string;
  action: ActionBinding;
  availableActions: ActionDefinition[];
  onUpdate: (actionId: string, updates: Partial<ActionBinding>) => void;
  onClose: () => void;
}

const ActionForm: React.FC<ActionFormProps> = ({ actionId, action, availableActions, onUpdate, onClose }) => {
  const actionDef = availableActions.find(a => a.id === action.type);
  if (!actionDef) return null;

  return (
    <div className="space-y-4 p-4 bg-muted/50 rounded-lg border">
      <div className="flex items-center justify-between">
        <Typography variant="h4" className="font-medium" noMargin>
          Configure {action.label}
        </Typography>
        <Button
          variant="outline"
          size="sm"
          onClick={onClose}
        >
          Done
        </Button>
      </div>

      <div className="grid gap-4">
        {/* Action Label */}
        <div>
          <label className="block text-sm font-medium mb-1">Action Label</label>
          <input
            type="text"
            value={action.label}
            onChange={(e) => onUpdate(actionId, { label: e.target.value })}
            className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground"
            placeholder="Display name for this action"
          />
        </div>

        {/* Action Description */}
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            value={action.description || ''}
            onChange={(e) => onUpdate(actionId, { description: e.target.value })}
            className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground"
            placeholder="What does this action do?"
            rows={2}
          />
        </div>

        {/* Parameters */}
        <div>
          <Typography variant="body1" className="font-medium mb-3" noMargin>Parameters</Typography>
          <div className="space-y-3">
            {actionDef.parameters.map(param => (
              <div key={param.name}>
                <label className="block text-sm font-medium mb-1">
                  {param.name}
                  {param.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                <input
                  type={param.type === 'number' ? 'number' : 'text'}
                  value={action.parameters[param.name] || ''}
                  onChange={(e) => {
                    const value = param.type === 'number' ? 
                      parseFloat(e.target.value) || 0 : 
                      e.target.value;
                    
                    onUpdate(actionId, {
                      parameters: {
                        ...action.parameters,
                        [param.name]: value
                      }
                    });
                  }}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground"
                  placeholder={param.description}
                  required={param.required}
                />
                <Typography variant="body1" className="text-xs text-muted-foreground mt-1" noMargin>
                  {param.description}
                </Typography>
              </div>
            ))}
          </div>
        </div>

        {/* Triggers */}
        <div>
          <label className="block text-sm font-medium mb-1">Triggers</label>
          <div className="flex flex-wrap gap-2">
            {['click', 'hover', 'load', 'submit'].map(trigger => (
              <label key={trigger} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={action.triggers.includes(trigger)}
                  onChange={(e) => {
                    const triggers = e.target.checked
                      ? [...action.triggers, trigger]
                      : action.triggers.filter(t => t !== trigger);
                    onUpdate(actionId, { triggers });
                  }}
                  className="rounded border-input"
                />
                <span className="text-sm capitalize">{trigger}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Enabled Toggle */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id={`enabled-${actionId}`}
            checked={action.enabled}
            onChange={(e) => onUpdate(actionId, { enabled: e.target.checked })}
            className="rounded border-input"
          />
          <label htmlFor={`enabled-${actionId}`} className="text-sm font-medium">
            Action enabled
          </label>
        </div>
      </div>
    </div>
  );
};

/**
 * Action editor component for managing blockchain action bindings
 * Allows configuration of Hedera network actions and custom actions
 */
const ActionEditor: React.FC<ActionEditorProps> = ({
  actions,
  onChange,
  className
}) => {
  const [availableActions, setAvailableActions] = useState<ActionDefinition[]>([]);
  const [selectedActionType, setSelectedActionType] = useState<string>('');
  const [editingAction, setEditingAction] = useState<string | null>(null);

  // Load available actions (mock data for now - would come from standards-sdk)
  useEffect(() => {
    const mockActions: ActionDefinition[] = [
      {
        id: 'hedera-transfer',
        name: 'HBAR Transfer',
        description: 'Transfer HBAR tokens to another account',
        icon: HiCurrencyDollar,
        category: 'hedera',
        parameters: [
          {
            name: 'toAccountId',
            type: 'string',
            required: true,
            description: 'Recipient account ID (e.g., 0.0.123456)',
          },
          {
            name: 'amount',
            type: 'number',
            required: true,
            description: 'Amount in HBAR',
            defaultValue: 1
          },
          {
            name: 'memo',
            type: 'string',
            required: false,
            description: 'Optional memo text',
          }
        ]
      },
      {
        id: 'hedera-token-transfer',
        name: 'Token Transfer',
        description: 'Transfer fungible or non-fungible tokens',
        icon: HiCurrencyDollar,
        category: 'hedera',
        parameters: [
          {
            name: 'tokenId',
            type: 'string',
            required: true,
            description: 'Token ID (e.g., 0.0.789012)',
          },
          {
            name: 'toAccountId',
            type: 'string',
            required: true,
            description: 'Recipient account ID',
          },
          {
            name: 'amount',
            type: 'number',
            required: true,
            description: 'Amount to transfer',
            defaultValue: 1
          }
        ]
      },
      {
        id: 'hedera-topic-message',
        name: 'Topic Message',
        description: 'Submit a message to Hedera Consensus Service',
        icon: HiDocumentText,
        category: 'hedera',
        parameters: [
          {
            name: 'topicId',
            type: 'string',
            required: true,
            description: 'Topic ID (e.g., 0.0.345678)',
          },
          {
            name: 'message',
            type: 'string',
            required: true,
            description: 'Message content',
          }
        ]
      },
      {
        id: 'custom-webhook',
        name: 'Custom Webhook',
        description: 'Call a custom webhook endpoint',
        icon: HiGlobeAlt,
        category: 'custom',
        parameters: [
          {
            name: 'url',
            type: 'string',
            required: true,
            description: 'Webhook URL',
          },
          {
            name: 'method',
            type: 'string',
            required: true,
            description: 'HTTP method',
            defaultValue: 'POST'
          },
          {
            name: 'payload',
            type: 'string',
            required: false,
            description: 'JSON payload',
          }
        ]
      }
    ];

    setAvailableActions(mockActions);
  }, []);

  const handleAddAction = () => {
    if (!selectedActionType) return;

    const actionDef = availableActions.find(a => a.id === selectedActionType);
    if (!actionDef) return;

    const actionId = `action-${Date.now()}`;
    const newAction: ActionBinding = {
      id: actionId,
      type: selectedActionType,
      label: actionDef.name,
      description: actionDef.description,
      parameters: {},
      triggers: ['click'], // Default trigger
      enabled: true
    };

    // Set default parameter values
    actionDef.parameters.forEach(param => {
      if (param.defaultValue !== undefined) {
        newAction.parameters[param.name] = param.defaultValue;
      }
    });

    const updatedActions = {
      ...actions,
      [actionId]: newAction
    };

    onChange(updatedActions);
    setSelectedActionType('');
    setEditingAction(actionId);
  };

  const handleRemoveAction = (actionId: string) => {
    const { [actionId]: removed, ...remaining } = actions;
    onChange(remaining);
    if (editingAction === actionId) {
      setEditingAction(null);
    }
  };

  const handleUpdateAction = (actionId: string, updates: Partial<ActionBinding>) => {
    const current = actions[actionId];
    if (!current) return;

    const updatedActions = {
      ...actions,
      [actionId]: {
        ...current,
        ...updates
      }
    };

    onChange(updatedActions);
  };


  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'hedera':
        return HiGlobeAlt;
      case 'web3':
        return HiCurrencyDollar;
      default:
        return HiBolt;
    }
  };

  return (
    <div className={cn("h-full flex flex-col", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Typography variant="h4" className="font-medium">
          {Object.keys(actions).length} Actions
        </Typography>
      </div>

      {/* Add new action */}
      <div className="mb-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-2">
              <select
                value={selectedActionType}
                onChange={(e) => setSelectedActionType(e.target.value)}
                className="flex-1 px-3 py-2 border border-input rounded-lg bg-background text-foreground"
              >
                <option value="">Select an action type</option>
                {availableActions.map(action => {
                  const CategoryIcon = getCategoryIcon(action.category);
                  return (
                    <option key={action.id} value={action.id}>
                      {action.name} - {action.description}
                    </option>
                  );
                })}
              </select>
              <Button onClick={handleAddAction} disabled={!selectedActionType}>
                <HiPlus className="w-4 h-4 mr-2" />
                Add
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions list */}
      <div className="flex-1 min-h-0">
        {Object.keys(actions).length === 0 ? (
          <Card className="h-full">
            <CardContent className="flex flex-col items-center justify-center text-center p-8 h-full">
              <div className="w-16 h-16 mb-4 rounded-lg bg-gradient-to-br from-hgo-blue to-hgo-green flex items-center justify-center">
                <HiBolt className="w-8 h-8 text-white" />
              </div>
              <Typography variant="h3" className="text-xl font-bold mb-2" noMargin>
                No Actions Configured
              </Typography>
              <Typography variant="body1" className="text-muted-foreground mb-4" noMargin>
                Add blockchain actions to make your blocks interactive
              </Typography>
              <Typography variant="body1" className="text-sm text-muted-foreground" noMargin>
                Available actions: HBAR transfers, token operations, topic messages, and custom webhooks
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <ScrollArea className="h-full">
            <div className="space-y-4 pr-4">
              {Object.entries(actions).map(([actionId, action]) => {
                const actionDef = availableActions.find(a => a.id === action.type);
                const Icon = actionDef?.icon || HiBolt;
                const isEditing = editingAction === actionId;

                return (
                  <Card key={actionId}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-gradient-to-br from-hgo-blue to-hgo-green flex items-center justify-center">
                            <Icon className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{action.label}</CardTitle>
                            <div className="flex items-center gap-2">
                              <span className="text-xs px-2 py-1 bg-muted rounded">
                                {actionDef?.category || 'custom'}
                              </span>
                              <span className="text-xs px-2 py-1 bg-muted rounded">
                                {action.triggers.join(', ')}
                              </span>
                              {!action.enabled && (
                                <span className="text-xs px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 rounded">
                                  disabled
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingAction(isEditing ? null : actionId)}
                          >
                            <HiPencil className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveAction(actionId)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <HiTrash className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {/* Action configuration form */}
                      {isEditing && (
                        <ActionForm
                          actionId={actionId}
                          action={action}
                          availableActions={availableActions}
                          onUpdate={handleUpdateAction}
                          onClose={() => setEditingAction(null)}
                        />
                      )}

                      {/* Action description */}
                      {action.description && (
                        <Typography variant="body1" className="text-sm text-muted-foreground" noMargin>
                          {action.description}
                        </Typography>
                      )}

                      {/* Parameters summary */}
                      {!isEditing && Object.keys(action.parameters).length > 0 && (
                        <div className="p-3 bg-muted/50 rounded border">
                          <Typography variant="body1" className="text-sm font-medium mb-2" noMargin>
                            Configured Parameters:
                          </Typography>
                          <div className="space-y-1">
                            {Object.entries(action.parameters).map(([key, value]) => (
                              <div key={key} className="flex items-center justify-between text-xs">
                                <span className="font-mono text-muted-foreground">{key}:</span>
                                <span className="font-mono">{String(value)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
};

export default ActionEditor;