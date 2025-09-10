import React, { useState, useMemo } from 'react';
import {
  HiCodeBracket,
  HiAdjustmentsHorizontal,
  HiCog6Tooth,
} from 'react-icons/hi2';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../ui/tabs';
import { ScrollArea } from '../../../ui/scroll-area';
import Typography from '../../../ui/Typography';
import {
  useBlockTesterStore,
  useBlockValidation,
} from '../../../../stores/blockTesterStore';
import { AttributeSchema } from '../../../../types/block-tester.types';
import { cn } from '../../../../lib/utils';
import TemplateEditor from './TemplateEditor';
import AttributeEditor from './AttributeEditor';
import InscriptionButton from '../inscription/InscriptionButton';
import InscriptionStatusModal from '../inscription/InscriptionStatusModal';

interface BlockEditorProps {
  className?: string;
}

const BlockEditor: React.FC<BlockEditorProps> = ({ className }) => {
  const {
    currentBlock,
    template,
    attributes,
    updateTemplate,
    updateAttributes,
  } = useBlockTesterStore();

  const validateBlock = useBlockValidation();
  const validation = useMemo(() => validateBlock(), [validateBlock]);
  const [activeTab, setActiveTab] = useState('template');

  const handleTemplateChange = (newTemplate: string) => {
    updateTemplate(newTemplate);
  };

  const handleAttributesChange = (newAttributes: Record<string, any>) => {
    const convertedAttributes = Object.fromEntries(
      Object.entries(newAttributes).map(([key, data]) => [
        key,
        data && typeof data === 'object' && 'schema' in data ? data : { schema: data, value: '' }
      ])
    );
    updateAttributes(convertedAttributes);
  };

  const convertToAttributeData = (attrs: Record<string, unknown>): Record<string, any> => {
    return Object.fromEntries(
      Object.entries(attrs).map(([key, value]) => {
        if (value && typeof value === 'object' && 'schema' in value) {
          return [key, value];
        }
        return [key, {
          schema: value || {
            type: 'string' as const,
            label: key,
            required: false,
            default: ''
          },
          value: ''
        }];
      })
    );
  };

  if (!currentBlock) {
    return null;
  }

  return (
    <div
      className={cn(
        'h-full flex flex-col bg-background border rounded-lg',
        className
      )}
    >
      <div className='px-4 pt-4 space-y-3'>
        <div className='flex items-center justify-end'>
          <InscriptionButton
            block={currentBlock}
            isValid={validation.isValid}
          />
        </div>

        <div className='p-3 bg-muted/30 rounded-lg border'>
          <div className='flex items-baseline gap-2 mb-2'>
            <Typography
              variant='body2'
              className='font-medium text-sm'
              noMargin
            >
              Block Description
            </Typography>
            <Typography
              variant='body2'
              className='text-xs text-red-500'
              noMargin
            >
              Required for inscription
            </Typography>
          </div>
          <input
            type='text'
            className='w-full p-2 bg-background border rounded-md text-sm'
            placeholder='Describe your block (required to inscribe)...'
            value={currentBlock?.description || ''}
            onChange={(e) => {
              if (currentBlock) {
                useBlockTesterStore.setState({
                  currentBlock: {
                    ...currentBlock,
                    description: e.target.value,
                    modified: new Date(),
                  },
                });
              }
            }}
          />
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className='flex-1 flex flex-col p-4 overflow-hidden'
      >
        <TabsList className='w-full flex-shrink-0'>
          <TabsTrigger value='template' className='flex items-center gap-2'>
            <HiCodeBracket className='w-4 h-4' />
            <span>Template</span>
          </TabsTrigger>
          <TabsTrigger value='attributes' className='flex items-center gap-2'>
            <HiAdjustmentsHorizontal className='w-4 h-4' />
            <span>Attributes</span>
          </TabsTrigger>
          <TabsTrigger value='settings' className='flex items-center gap-2'>
            <HiCog6Tooth className='w-4 h-4' />
            <span>Settings</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value='template' className='flex-1 mt-4 overflow-auto'>
          <TemplateEditor
            template={template}
            onChange={handleTemplateChange}
            errors={[]}
            templateSource={currentBlock.templateSource}
          />
        </TabsContent>

        <TabsContent value='attributes' className='flex-1 mt-4 overflow-auto'>
          <AttributeEditor
            attributes={convertToAttributeData(attributes)}
            onChange={handleAttributesChange}
          />
        </TabsContent>

        <TabsContent value='settings' className='flex-1 mt-4 overflow-auto'>
          <div className='space-y-4 p-4'>
            <div className='p-4 bg-muted rounded-lg'>
              <Typography variant='h4' noMargin>
                Block Information
              </Typography>
              <div className='space-y-2 text-sm'>
                <div>
                  <span className='text-muted-foreground'>Name:</span>{' '}
                  <span>{currentBlock.name || 'Untitled'}</span>
                </div>
                <div>
                  <span className='text-muted-foreground'>Category:</span>{' '}
                  <span>{currentBlock.category || 'custom'}</span>
                </div>
                <div>
                  <span className='text-muted-foreground'>Created:</span>{' '}
                  <span>
                    {new Date(currentBlock.created).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className='text-muted-foreground'>Modified:</span>{' '}
                  <span>
                    {new Date(currentBlock.modified).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            <div className='p-4 bg-muted rounded-lg'>
              <Typography variant='h4' noMargin>
                Description
              </Typography>
              <textarea
                className='w-full p-2 bg-background border rounded-md text-sm'
                rows={3}
                placeholder='Add a description...'
                value={currentBlock.description || ''}
                onChange={(e) => {
                  useBlockTesterStore.setState({
                    currentBlock: {
                      ...currentBlock,
                      description: e.target.value,
                      modified: new Date(),
                    },
                  });
                }}
              />
            </div>

            <div className='p-4 bg-muted rounded-lg'>
              <Typography variant='h4' noMargin>
                Keywords
              </Typography>
              <input
                type='text'
                className='w-full p-2 bg-background border rounded-md text-sm'
                placeholder='Enter keywords separated by commas...'
                value={currentBlock.keywords?.join(', ') || ''}
                onChange={(e) => {
                  useBlockTesterStore.setState({
                    currentBlock: {
                      ...currentBlock,
                      keywords: e.target.value
                        .split(',')
                        .map((k) => k.trim())
                        .filter(Boolean),
                      modified: new Date(),
                    },
                  });
                }}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <InscriptionStatusModal />
    </div>
  );
};

export default BlockEditor;
