import React from 'react';
import { 
  HiArrowPath,
  HiArrowTopRightOnSquare,
  HiComputerDesktop,
  HiDeviceTablet,
  HiDevicePhoneMobile
} from 'react-icons/hi2';
import { Button } from '../../../ui/Button';
import Typography from '../../../ui/Typography';
import { useBlockTesterStore } from '../../../../stores/blockTesterStore';
import { cn } from '../../../../lib/utils';
import type { ViewportSize } from '../../../../types/block-tester.types';

interface PreviewControlsProps {
  onRefresh?: () => void;
  onOpenInNewWindow?: () => void;
  isLoading?: boolean;
  className?: string;
}

/**
 * Preview controls component for viewport switching and preview actions
 */
const PreviewControls: React.FC<PreviewControlsProps> = ({
  onRefresh,
  onOpenInNewWindow,
  isLoading = false,
  className
}) => {
  const { previewMode, setPreviewMode } = useBlockTesterStore();

  const viewportOptions = [
    { 
      mode: 'desktop' as ViewportSize, 
      icon: HiComputerDesktop, 
      label: 'Desktop',
      dimensions: '1200px'
    },
    { 
      mode: 'tablet' as ViewportSize, 
      icon: HiDeviceTablet, 
      label: 'Tablet',
      dimensions: '768px'
    },
    { 
      mode: 'mobile' as ViewportSize, 
      icon: HiDevicePhoneMobile, 
      label: 'Mobile',
      dimensions: '375px'
    }
  ];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Viewport selector */}
      <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 backdrop-blur-sm">
        {viewportOptions.map(({ mode, icon: Icon, label, dimensions }) => (
          <button
            key={mode}
            onClick={() => setPreviewMode(mode)}
            className={cn(
              "flex items-center justify-center w-8 h-8 rounded-md transition-all duration-200 group relative",
              previewMode === mode
                ? "bg-background text-foreground shadow-sm border"
                : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
            )}
            title={`${label} (${dimensions})`}
          >
            <Icon className="w-4 h-4" />
            
            {/* Tooltip */}
            <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
              <div className="bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                {label}
                <div className="text-muted-foreground">{dimensions}</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-border" />

      {/* Action buttons */}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
          className="h-8 px-2"
          title="Refresh preview"
        >
          <HiArrowPath className={cn(
            "w-4 h-4",
            isLoading && "animate-spin"
          )} />
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenInNewWindow}
          className="h-8 px-2"
          title="Open in new window"
        >
          <HiArrowTopRightOnSquare className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default PreviewControls;