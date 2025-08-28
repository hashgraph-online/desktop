import React, { useState, useCallback, useEffect } from 'react';
import { HiCodeBracket, HiExclamationTriangle, HiGlobeAlt, HiArrowDownTray, HiClock, HiArrowsPointingOut } from 'react-icons/hi2';
import { Card } from '../../../ui/Card';
import { Button } from '../../../ui/Button';
import Typography from '../../../ui/Typography';
import Modal from '../../../ui/Modal';
import { useBlockTesterStore } from '../../../../stores/blockTesterStore';
import { useConfigStore } from '../../../../stores/configStore';
import { cn } from '../../../../lib/utils';
import { debounce } from '../../../../utils/block-tester';
import type { ErrorLog, TemplateSource } from '../../../../types/block-tester.types';
import BlockTesterErrorBoundary from '../shared/ErrorBoundary';
import * as Handlebars from 'handlebars';
import { BlockLoader, Logger, type NetworkType } from '@hashgraphonline/standards-sdk';
import MonacoEditor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

loader.config({ monaco });

interface TemplateEditorProps {
  template: string;
  onChange: (template: string) => void;
  errors?: ErrorLog[];
  className?: string;
  templateSource?: TemplateSource;
}

type TemplateSourceType = 'inline' | 'hcs';

interface HCSTemplate {
  template: string;
  definition?: Record<string, unknown>;
  topicId: string;
  lastFetched: Date;
  cached: boolean;
}

interface TemplateExample {
  name: string;
  template: string;
  attributes: Record<string, unknown>;
}

/**
 * Template editor component with Monaco Editor integration and developer-friendly interface
 * Features syntax highlighting for HTML and Handlebars templates with clear guidance for new users
 */
const TemplateEditor: React.FC<TemplateEditorProps> = ({
  template,
  onChange,
  errors = [],
  className,
  templateSource: templateSourceProp
}) => {
  const { config } = useConfigStore();
  const isDarkMode = config?.advanced?.theme === 'dark';
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const [templateSource, setTemplateSource] = useState<TemplateSourceType>('inline');
  const [topicId, setTopicId] = useState('0.0.6617393');
  const [networkType, setNetworkType] = useState<NetworkType>('testnet');
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);
  const [hcsTemplate, setHCSTemplate] = useState<HCSTemplate | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const debouncedOnChange = useCallback(
    debounce((value: string) => {
      onChange(value || '');
    }, 300),
    [onChange]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isFullscreen && e.key === 'Escape') {
        setIsFullscreen(false);
      }
    };

    if (isFullscreen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isFullscreen]);

  const DEFAULT_STARTER_TEMPLATE = `<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-sm max-w-md mx-auto">
  <div class="flex items-center gap-3 mb-4">
    <div class="w-8 h-8 bg-blue-500 rounded-lg flex-shrink-0"></div>
    <div>
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{title}}</h2>
      <p class="text-sm text-gray-600 dark:text-gray-400">{{subtitle}}</p>
    </div>
  </div>
  
  <p class="text-gray-700 dark:text-gray-300 mb-4">
    {{content}}
  </p>
  
  <div class="flex gap-2">
    <button class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm font-medium">
      {{buttonText}}
    </button>
    <button class="px-4 py-2 border border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md text-sm font-medium">
      Cancel
    </button>
  </div>
</div>`;

  const templateExamples: TemplateExample[] = [
    {
      name: 'Starter Template',
      template: DEFAULT_STARTER_TEMPLATE,
      attributes: {
        title: 'Welcome to Block Builder',
        subtitle: 'Build amazing components',
        content: 'This is your first block template. Edit the template above to customize how your block looks and works.',
        buttonText: 'Get Started'
      }
    },
    {
      name: 'Simple Card',
      template: `<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm">
  <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">{{title}}</h3>
  <p class="text-gray-600 dark:text-gray-400">{{description}}</p>
</div>`,
      attributes: {
        title: 'Card Title',
        description: 'Your card description goes here'
      }
    },
    {
      name: 'Alert Message',
      template: `<div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
  <div class="flex items-center gap-3">
    <div class="w-5 h-5 bg-blue-500 rounded-full flex-shrink-0"></div>
    <div>
      <h4 class="text-blue-900 dark:text-blue-100 font-medium">{{title}}</h4>
      <p class="text-blue-700 dark:text-blue-300 text-sm mt-1">{{message}}</p>
    </div>
  </div>
</div>`,
      attributes: {
        title: 'Info',
        message: 'This is an important message for your users'
      }
    }
  ];

  const validateTopicId = (id: string): boolean => {
    const topicIdPattern = /^0\.0\.\d+$/;
    return topicIdPattern.test(id);
  };

  const loadHCSTemplate = useCallback(async (topicIdToLoad: string, forceRefresh: boolean = false) => {
    if (!topicIdToLoad || !validateTopicId(topicIdToLoad)) {
      setLoadError('Invalid topic ID format. Use format: 0.0.xxxxxx');
      return;
    }

    setIsLoadingTemplate(true);
    setLoadError(null);

    try {
      if (!forceRefresh && hcsTemplate && 
          hcsTemplate.topicId === topicIdToLoad &&
          Date.now() - hcsTemplate.lastFetched.getTime() < 5 * 60 * 1000) {
        setIsLoadingTemplate(false);
        return;
      }

      const logger = new Logger({ module: 'TemplateLoader' });
      const blockLoader = new BlockLoader(networkType, logger);
      
      const blockData = await blockLoader.loadBlock(topicIdToLoad);
      
      if (blockData && blockData.template) {
        const loadedTemplate: HCSTemplate = {
          template: blockData.template,
          definition: blockData.definition as unknown as Record<string, unknown>,
          topicId: topicIdToLoad,
          lastFetched: new Date(),
          cached: true
        };

        setHCSTemplate(loadedTemplate);
        onChange(blockData.template);
        
        if (blockData.definition && (blockData.definition as unknown as Record<string, unknown>).attributes) {
          const { updateAttributes } = useBlockTesterStore.getState();
          const structuredAttributes: Record<string, Record<string, unknown>> = {};
          const attributes = (blockData.definition as unknown as Record<string, unknown>).attributes as Record<string, Record<string, unknown>>;
          Object.entries(attributes).forEach(([key, attr]) => {
            structuredAttributes[key] = {
              schema: {
                type: attr.type || 'string',
                label: key.charAt(0).toUpperCase() + key.slice(1),
                required: attr.required || false,
                placeholder: attr.placeholder || `Enter ${key}`,
                default: attr.default
              },
              value: attr.default || ''
            };
          });
          updateAttributes(structuredAttributes);
        }

        setTemplateSource('hcs');
        
      } else {
        setLoadError('No template found for this topic ID');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load template from HCS';
      setLoadError(errorMessage);
    } finally {
      setIsLoadingTemplate(false);
    }
  }, [topicId, networkType, hcsTemplate, onChange]);

  const handleLoadTemplate = () => {
    if (topicId && validateTopicId(topicId)) {
      loadHCSTemplate(topicId, false);
    }
  };

  const handleForceRefresh = () => {
    if (topicId && validateTopicId(topicId)) {
      loadHCSTemplate(topicId, true);
    }
  };

  const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor, monacoInstance: typeof monaco) => {
    monacoInstance.languages.register({ id: 'handlebars' });
    
    monacoInstance.languages.setLanguageConfiguration('handlebars', {
      wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g,
      comments: {
        blockComment: ['{{!--', '--}}'],
      },
      brackets: [
        ['{{', '}}'],
        ['<', '>'],
        ['{', '}'],
        ['[', ']'],
        ['(', ')'],
      ],
      autoClosingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: "'", close: "'" },
        { open: '{{', close: '}}' },
        { open: '<', close: '>' },
      ],
      surroundingPairs: [
        { open: '"', close: '"' },
        { open: "'", close: "'" },
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '<', close: '>' },
      ],
    });

    monacoInstance.languages.setMonarchTokensProvider('handlebars', {
      defaultToken: '',
      tokenPostfix: '.handlebars',
      
      tokenizer: {
        root: [
          [/\{\{!--/, 'comment.block.handlebars', '@handlebarsComment'],
          [/\{\{[#\/]/, 'keyword.block.handlebars'],
          [/\{\{/, 'delimiter.handlebars'],
          [/\}\}/, 'delimiter.handlebars'],
          { include: 'html' }
        ],
        
        handlebarsComment: [
          [/--\}\}/, 'comment.block.handlebars', '@pop'],
          [/./, 'comment.block.handlebars']
        ],
        
        html: [
          [/<!DOCTYPE/, 'metatag', '@doctype'],
          [/<!--/, 'comment', '@comment'],
          [/(<)(script)/, ['delimiter', { token: 'tag', next: '@script' }]],
          [/(<)(style)/, ['delimiter', { token: 'tag', next: '@style' }]],
          [/(<)((?:[\w\-]+:)?[\w\-]+)/, ['delimiter', { token: 'tag', next: '@otherTag' }]],
          [/(<\/)((?:[\w\-]+:)?[\w\-]+)/, ['delimiter', { token: 'tag', next: '@otherTag' }]],
          [/</, 'delimiter'],
          [/[^<]+/, '']
        ],

        doctype: [
          [/[^>]+/, 'metatag.content'],
          [/>/, 'metatag', '@pop'],
        ],

        comment: [
          [/-->/, 'comment', '@pop'],
          [/[^-]+/, 'comment.content'],
          [/./, 'comment.content']
        ],

        otherTag: [
          [/\/?>/, 'delimiter', '@pop'],
          [/"([^"]*)"/, 'attribute.value'],
          [/'([^']*)'/, 'attribute.value'],
          [/[\w\-]+/, 'attribute.name'],
          [/=/, 'delimiter'],
          [/[ \t\r\n]+/, ''],
        ],

        script: [
          [/type/, 'attribute.name', '@scriptAfterType'],
          [/"([^"]*)"/, 'attribute.value'],
          [/'([^']*)'/, 'attribute.value'],
          [/[\w\-]+/, 'attribute.name'],
          [/=/, 'delimiter'],
          [/>/, { token: 'delimiter', next: '@scriptEmbedded', nextEmbedded: 'text/javascript' }],
          [/[ \t\r\n]+/, ''],
          [/(<\/)(script\s*)(>)/, ['delimiter', 'tag', { token: 'delimiter', next: '@pop' }]]
        ],

        scriptAfterType: [
          [/=/, 'delimiter', '@scriptAfterTypeEquals'],
          [/>/, { token: 'delimiter', next: '@scriptEmbedded', nextEmbedded: 'text/javascript' }],
          [/[ \t\r\n]+/, ''],
          [/<\/script\s*>/, { token: '@rematch', next: '@pop' }]
        ],

        scriptAfterTypeEquals: [
          [/"([^"]*)"/, { token: 'attribute.value', switchTo: '@scriptWithCustomType.$1' }],
          [/'([^']*)'/, { token: 'attribute.value', switchTo: '@scriptWithCustomType.$1' }],
          [/>/, { token: 'delimiter', next: '@scriptEmbedded', nextEmbedded: 'text/javascript' }],
          [/[ \t\r\n]+/, ''],
          [/<\/script\s*>/, { token: '@rematch', next: '@pop' }]
        ],

        scriptWithCustomType: [
          [/>/, { token: 'delimiter', next: '@scriptEmbedded.$S2', nextEmbedded: '$S2' }],
          [/"([^"]*)"/, 'attribute.value'],
          [/'([^']*)'/, 'attribute.value'],
          [/[\w\-]+/, 'attribute.name'],
          [/=/, 'delimiter'],
          [/[ \t\r\n]+/, ''],
          [/<\/script\s*>/, { token: '@rematch', next: '@pop' }]
        ],

        scriptEmbedded: [
          [/<\/script/, { token: '@rematch', next: '@pop', nextEmbedded: '@pop' }],
          [/[^<]+/, '']
        ],

        style: [
          [/type/, 'attribute.name', '@styleAfterType'],
          [/"([^"]*)"/, 'attribute.value'],
          [/'([^']*)'/, 'attribute.value'],
          [/[\w\-]+/, 'attribute.name'],
          [/=/, 'delimiter'],
          [/>/, { token: 'delimiter', next: '@styleEmbedded', nextEmbedded: 'text/css' }],
          [/[ \t\r\n]+/, ''],
          [/(<\/)(style\s*)(>)/, ['delimiter', 'tag', { token: 'delimiter', next: '@pop' }]]
        ],

        styleAfterType: [
          [/=/, 'delimiter', '@styleAfterTypeEquals'],
          [/>/, { token: 'delimiter', next: '@styleEmbedded', nextEmbedded: 'text/css' }],
          [/[ \t\r\n]+/, ''],
          [/<\/style\s*>/, { token: '@rematch', next: '@pop' }]
        ],

        styleAfterTypeEquals: [
          [/"([^"]*)"/, { token: 'attribute.value', switchTo: '@styleWithCustomType.$1' }],
          [/'([^']*)'/, { token: 'attribute.value', switchTo: '@styleWithCustomType.$1' }],
          [/>/, { token: 'delimiter', next: '@styleEmbedded', nextEmbedded: 'text/css' }],
          [/[ \t\r\n]+/, ''],
          [/<\/style\s*>/, { token: '@rematch', next: '@pop' }]
        ],

        styleWithCustomType: [
          [/>/, { token: 'delimiter', next: '@styleEmbedded.$S2', nextEmbedded: '$S2' }],
          [/"([^"]*)"/, 'attribute.value'],
          [/'([^']*)'/, 'attribute.value'],
          [/[\w\-]+/, 'attribute.name'],
          [/=/, 'delimiter'],
          [/[ \t\r\n]+/, ''],
          [/<\/style\s*>/, { token: '@rematch', next: '@pop' }]
        ],

        styleEmbedded: [
          [/<\/style/, { token: '@rematch', next: '@pop', nextEmbedded: '@pop' }],
          [/[^<]+/, '']
        ],
      }
    });

    monacoInstance.languages.registerCompletionItemProvider('handlebars', {
      provideCompletionItems: (model: monaco.editor.ITextModel, position: monaco.Position) => {
        const { attributes } = useBlockTesterStore.getState();
        
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn
        };
        
        const suggestions: monaco.languages.CompletionItem[] = [
          {
            label: '{{content}}',
            kind: monacoInstance.languages.CompletionItemKind.Variable,
            insertText: '{{content}}',
            documentation: 'Main content variable',
            detail: 'Default content placeholder',
            range: range
          },
          {
            label: '{{title}}',
            kind: monacoInstance.languages.CompletionItemKind.Variable,
            insertText: '{{title}}',
            documentation: 'Title attribute',
            detail: 'Block title variable',
            range: range
          },
          {
            label: '{{description}}',
            kind: monacoInstance.languages.CompletionItemKind.Variable,
            insertText: '{{description}}',
            documentation: 'Description attribute',
            detail: 'Block description variable',
            range: range
          },
          ...Object.keys(attributes).map(key => ({
            label: `{{${key}}}`,
            kind: monacoInstance.languages.CompletionItemKind.Variable,
            insertText: `{{${key}}}`,
            documentation: `Attribute: ${key}`,
            detail: 'Block attribute variable',
            range: range
          })),
          {
            label: '{{#if condition}}',
            kind: monacoInstance.languages.CompletionItemKind.Snippet,
            insertText: '{{#if ${1:condition}}}\n  $0\n{{/if}}',
            insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Conditional block',
            detail: 'Handlebars if helper',
            range: range
          },
          {
            label: '{{#each items}}',
            kind: monacoInstance.languages.CompletionItemKind.Snippet,
            insertText: '{{#each ${1:items}}}\n  $0\n{{/each}}',
            insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Loop block',
            detail: 'Handlebars each helper',
            range: range
          }
        ];
        return { suggestions };
      }
    });

    const validateTemplate = (templateContent: string) => {
      try {
        Handlebars.compile(templateContent);
        const model = editor.getModel();
        if (model) {
          monacoInstance.editor.setModelMarkers(model, 'handlebars', []);
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Template syntax error';
        const markers: monaco.editor.IMarkerData[] = [{
          severity: monacoInstance.MarkerSeverity.Error,
          message: `Handlebars syntax error: ${errorMessage}`,
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: 1,
          endColumn: 1
        }];
        const model = editor.getModel();
        if (model) {
          monacoInstance.editor.setModelMarkers(model, 'handlebars', markers);
        }
      }
    };

    editor.onDidChangeModelContent(() => {
      const currentValue = editor.getValue();
      if (currentValue) {
        validateTemplate(currentValue);
      }
    });

    if (template) {
      validateTemplate(template);
    }

    monacoInstance.editor.defineTheme('hgo-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'tag', foreground: '#ff79c6', fontStyle: 'bold' },
        { token: 'delimiter', foreground: '#f8f8f2' },
        { token: 'delimiter.html', foreground: '#f8f8f2' },
        { token: 'attribute.name', foreground: '#50fa7b' },
        { token: 'attribute.value', foreground: '#f1fa8c' },
        { token: 'delimiter.handlebars', foreground: '#ff79c6', fontStyle: 'bold' },
        { token: 'keyword.block.handlebars', foreground: '#bd93f9', fontStyle: 'bold' },
        { token: 'comment', foreground: '#6272a4', fontStyle: 'italic' },
        { token: 'comment.block.handlebars', foreground: '#6272a4', fontStyle: 'italic' },
        { token: 'metatag', foreground: '#ff79c6', fontStyle: 'bold' },
        { token: 'metatag.content', foreground: '#f1fa8c' },
      ],
      colors: {
        'editor.background': '#0a0a0a',
        'editor.foreground': '#f8f8f2',
        'editorLineNumber.foreground': '#6b7280',
        'editorCursor.foreground': '#f8f8f2',
        'editor.selectionBackground': '#44475a',
        'editor.lineHighlightBackground': '#1f293720',
        'editorSuggestWidget.background': '#1f2937',
        'editorSuggestWidget.border': '#374151',
        'editorSuggestWidget.foreground': '#f9fafb',
        'editorSuggestWidget.selectedBackground': '#44475a',
        'editorIndentGuide.background': '#44475a',
        'editorIndentGuide.activeBackground': '#6b7280',
      }
    });

    monacoInstance.editor.defineTheme('hgo-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'tag', foreground: '#ec4899', fontStyle: 'bold' },
        { token: 'delimiter', foreground: '#1f2937' },
        { token: 'delimiter.html', foreground: '#1f2937' },
        { token: 'attribute.name', foreground: '#10b981' },
        { token: 'attribute.value', foreground: '#eab308' },
        { token: 'delimiter.handlebars', foreground: '#ec4899', fontStyle: 'bold' },
        { token: 'keyword.block.handlebars', foreground: '#a855f7', fontStyle: 'bold' },
        { token: 'comment', foreground: '#9ca3af', fontStyle: 'italic' },
        { token: 'comment.block.handlebars', foreground: '#9ca3af', fontStyle: 'italic' },
        { token: 'metatag', foreground: '#ec4899', fontStyle: 'bold' },
        { token: 'metatag.content', foreground: '#eab308' },
      ],
      colors: {
        'editor.background': '#ffffff',
        'editor.foreground': '#111827',
        'editorLineNumber.foreground': '#9ca3af',
        'editorCursor.foreground': '#111827',
        'editor.selectionBackground': '#ddd6fe50',
        'editor.lineHighlightBackground': '#f9fafb50',
        'editorSuggestWidget.background': '#ffffff',
        'editorSuggestWidget.border': '#e5e7eb',
        'editorSuggestWidget.foreground': '#111827',
        'editorSuggestWidget.selectedBackground': '#f3f4f6',
        'editorIndentGuide.background': '#e5e7eb',
        'editorIndentGuide.activeBackground': '#9ca3af',
      }
    });

    setIsEditorReady(true);
  };

  const { updateAttributes } = useBlockTesterStore();
  
  // Initialize state from templateSource prop
  useEffect(() => {
    if (templateSourceProp) {
      if (templateSourceProp.type === 'hcs' && templateSourceProp.topicId) {
        setTemplateSource('hcs');
        setTopicId(templateSourceProp.topicId);
      } else if (templateSourceProp.type === 'inline') {
        setTemplateSource('inline');
      }
    }
  }, [templateSourceProp]);

  useEffect(() => {
    if (templateSource === 'hcs' && topicId && !hcsTemplate) {
      loadHCSTemplate(topicId, false);
    }
  }, [templateSource, topicId, hcsTemplate, loadHCSTemplate]);
  
  const handleExampleSelect = (example: TemplateExample) => {
    onChange(example.template);
    if (example.attributes) {
      const structuredAttributes: Record<string, Record<string, unknown>> = {};
      Object.entries(example.attributes).forEach(([key, value]) => {
        structuredAttributes[key] = {
          schema: {
            type: 'string',
            label: key.charAt(0).toUpperCase() + key.slice(1),
            required: false,
            placeholder: `Enter ${key}`
          },
          value: value
        };
      });
      updateAttributes(structuredAttributes);
    }
  };

  const LoadingEditor = () => (
    <div className="h-full flex items-center justify-center bg-muted/50 rounded-lg border">
      <div className="text-center">
        <span className="block w-8 h-8 mx-auto mb-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <Typography variant="body1" className="text-muted-foreground" noMargin>
          Loading Monaco Editor...
        </Typography>
      </div>
    </div>
  );

  const ErrorEditor = () => (
    <Card className="h-full flex items-center justify-center">
      <div className="text-center p-6">
        <HiExclamationTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
        <Typography variant="h4" className="mb-2" noMargin>
          Editor Failed to Load
        </Typography>
        <Typography variant="body1" className="text-muted-foreground mb-4" noMargin>
          Monaco Editor could not be loaded. Using fallback text editor.
        </Typography>
        <textarea
          value={template}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-64 p-3 border border-input rounded-lg bg-background text-foreground font-mono text-sm resize-none"
          placeholder={`Enter your HTML template here...

Use Handlebars expressions like:
- {{title}} for dynamic content
- {{#if condition}} for conditionals
- {{#each items}} for loops`}
        />
      </div>
    </Card>
  );


  return (
    <>
      <Modal
        isOpen={isFullscreen}
        onClose={() => setIsFullscreen(false)}
        title="Fullscreen Template Editor"
        isFullscreen={true}
        headerAction={
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center">
            <HiCodeBracket className="w-4 h-4 text-white" />
          </div>
        }
      >
        <MonacoEditor
          value={template || ''}
          language="handlebars"
          theme={isDarkMode ? 'hgo-dark' : 'hgo-light'}
          height="100%"
          options={{
            minimap: { enabled: true },
            fontSize: 16,
            lineNumbers: 'on',
            renderLineHighlight: 'all',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            wordWrap: 'on',
            tabSize: 2,
            formatOnPaste: true,
            formatOnType: true,
            folding: true,
            bracketPairColorization: {
              enabled: true
            },
            suggest: {
              showKeywords: true,
              showSnippets: true,
            }
          }}
          onChange={debouncedOnChange}
          onMount={handleEditorDidMount}
          loading={<LoadingEditor />}
        />
      </Modal>

      <div className={cn("h-full flex flex-col gap-4", className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HiCodeBracket className="w-5 h-5 text-primary" />
            <Typography variant="h4" className="font-medium" noMargin>
              Template Editor
            </Typography>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsFullscreen(true)}
            className="h-8 px-2"
          >
            <HiArrowsPointingOut className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-baseline gap-2 flex-wrap">
          <Typography variant="body2" className="text-sm text-muted-foreground" noMargin>
            Quick start:
          </Typography>
          {templateExamples.map((example) => (
            <Button
              key={example.name}
              variant="ghost"
              size="sm"
              onClick={() => handleExampleSelect(example)}
              className="h-7 px-2 text-xs"
            >
              {example.name}
            </Button>
          ))}
        </div>

        {templateSource === 'hcs' && (
          <div className="bg-muted/10 rounded-lg p-3 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <HiGlobeAlt className="w-4 h-4 text-primary flex-shrink-0" />
              <Typography variant="body2" className="text-sm font-medium" noMargin>
                Load from HCS
              </Typography>
            </div>
            <div className="flex gap-2 items-center flex-wrap min-w-0">
              <select
                value={networkType}
                onChange={(e) => setNetworkType(e.target.value as NetworkType)}
                className="px-2 py-1 border border-input rounded text-xs bg-background flex-shrink-0"
              >
                <option value="testnet">Testnet</option>
                <option value="mainnet">Mainnet</option>
              </select>
              <input
                type="text"
                value={topicId}
                onChange={(e) => setTopicId(e.target.value)}
                placeholder="0.0.123456"
                className="flex-1 min-w-0 px-2 py-1 border border-input rounded text-xs bg-background"
              />
              <Button
                onClick={handleLoadTemplate}
                disabled={!topicId || !validateTopicId(topicId) || isLoadingTemplate}
                size="sm"
                className="h-7 px-3 text-xs flex-shrink-0 flex items-center gap-1"
              >
                {isLoadingTemplate ? (
                  <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <HiArrowDownTray className="w-3 h-3" />
                    Load
                  </>
                )}
              </Button>
            </div>
            
            {loadError && (
              <div className="mt-2 flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                <HiExclamationTriangle className="w-3 h-3" />
                {loadError}
              </div>
            )}

            {hcsTemplate && hcsTemplate.topicId === topicId && (
              <div className="mt-2 flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                Loaded at {hcsTemplate.lastFetched.toLocaleTimeString()}
              </div>
            )}
          </div>
        )}

        <div className="flex items-baseline gap-1">
          <Typography variant="body2" className="text-xs text-muted-foreground" noMargin>
            Source:
          </Typography>
          <Button
            variant={templateSource === 'inline' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setTemplateSource('inline')}
            className="h-6 px-2 text-xs"
          >
            Inline
          </Button>
          <Button
            variant={templateSource === 'hcs' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setTemplateSource('hcs')}
            className="h-6 px-2 text-xs flex items-center gap-1"
          >
            <HiGlobeAlt className="w-3 h-3" />
            HCS
          </Button>
        </div>

        <div className="flex-1 bg-background border border-border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-1.5 h-1.5 rounded-full",
                isEditorReady ? "bg-green-500" : "bg-yellow-500"
              )} />
              <Typography variant="body2" className="text-xs" noMargin>
                {isEditorReady ? 'Ready' : 'Loading...'}
              </Typography>
              {template && (
                <Typography variant="body2" className="text-xs text-muted-foreground" noMargin>
                  • {template.length} chars
                </Typography>
              )}
            </div>
            
            {errors.length > 0 && (
              <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                <HiExclamationTriangle className="w-3 h-3" />
                <Typography variant="body2" className="text-xs" noMargin>
                  {errors.length} error{errors.length !== 1 ? 's' : ''}
                </Typography>
              </div>
            )}
          </div>

          <div className="relative" style={{ height: 'calc(100vh - 320px)', minHeight: '400px' }}>
            {(!template || template.trim() === '') && isEditorReady && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <div className="text-center max-w-md px-4">
                  <HiCodeBracket className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                  <Typography variant="h4" className="text-muted-foreground/60 text-base mb-2" noMargin>
                    Start with a template above or write HTML
                  </Typography>
                  <div className="flex flex-wrap gap-2 justify-center text-xs text-muted-foreground/50">
                    <span className="font-mono bg-muted/30 px-2 py-1 rounded">{'{{title}}'}</span>
                    <span className="font-mono bg-muted/30 px-2 py-1 rounded">{'{{#if}}'}</span>
                    <span className="font-mono bg-muted/30 px-2 py-1 rounded">{'{{#each}}'}</span>
                  </div>
                </div>
              </div>
            )}
            
            <BlockTesterErrorBoundary fallback={() => <ErrorEditor />}>
              <MonacoEditor
                language="handlebars"
                value={template || DEFAULT_STARTER_TEMPLATE}
                onChange={debouncedOnChange}
                onMount={handleEditorDidMount}
                theme={isDarkMode ? 'hgo-dark' : 'hgo-light'}
                options={{
                  minimap: { enabled: false },
                  wordWrap: 'on',
                  automaticLayout: true,
                  formatOnPaste: true,
                  formatOnType: true,
                  lineNumbers: 'on',
                  glyphMargin: false,
                  folding: true,
                  lineDecorationsWidth: 0,
                  lineNumbersMinChars: 3,
                  scrollBeyondLastLine: false,
                  fontSize: 14,
                  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
                  tabSize: 2,
                  insertSpaces: true,
                  padding: { top: 16, bottom: 16 },
                  bracketPairColorization: {
                    enabled: true
                  },
                  guides: {
                    indentation: true,
                    highlightActiveIndentation: true
                  },
                  suggest: {
                    showKeywords: true,
                    showSnippets: true,
                  },
                  quickSuggestions: {
                    other: true,
                    comments: true,
                    strings: true
                  }
                }}
                loading={<LoadingEditor />}
              />
            </BlockTesterErrorBoundary>
          </div>
        </div>

        {errors.length > 0 && (
          <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
            <HiExclamationTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <Typography variant="body2" className="text-xs text-red-700 dark:text-red-300" noMargin>
              {errors[0].message}
              {errors.length > 1 && ` (+${errors.length - 1} more)`}
            </Typography>
          </div>
        )}
      </div>
    </>
  );
};


export default TemplateEditor;