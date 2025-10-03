import React from 'react';
import { cn } from '../../../lib/utils';
import type { TrafficLightVariant } from './constants';

const TRAFFIC_LIGHT_COLORS: Record<
  TrafficLightVariant,
  { background: string; iconColor: string }
> = {
  close: {
    background: 'bg-red-500 hover:bg-red-500/90',
    iconColor: 'text-white',
  },
  minimize: {
    background: 'bg-yellow-400 hover:bg-yellow-400/90',
    iconColor: 'text-brand-ink',
  },
  maximize: {
    background: 'bg-green-500 hover:bg-green-500/90',
    iconColor: 'text-white',
  },
};

interface TrafficLightButtonProps {
  variant: TrafficLightVariant;
  onClick: () => void;
  isExpanded?: boolean;
}

const TrafficLightButton: React.FC<TrafficLightButtonProps> = ({
  variant,
  onClick,
  isExpanded = false,
}) => {
  const { background, iconColor } = TRAFFIC_LIGHT_COLORS[variant];

  return (
    <button
      type='button'
      onClick={onClick}
      className={cn(
        'flex h-[16px] w-[16px] items-center justify-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
        background
      )}
      aria-label={
        variant === 'close'
          ? 'Close browser'
          : variant === 'minimize'
            ? 'Minimize browser'
            : isExpanded
              ? 'Restore browser size'
              : 'Maximize browser'
      }
      title={
        variant === 'close'
          ? 'Close'
          : variant === 'minimize'
            ? 'Minimize'
            : isExpanded
              ? 'Restore'
              : 'Maximize'
      }
    >
      <svg
        className={cn('h-[12px] w-[12px] text-current', iconColor)}
        viewBox='0 0 16 16'
        aria-hidden='true'
      >
        {variant === 'close' ? (
          <>
            <line
              x1='4'
              y1='4'
              x2='12'
              y2='12'
              stroke='currentColor'
              strokeWidth='1.6'
              strokeLinecap='round'
            />
            <line
              x1='12'
              y1='4'
              x2='4'
              y2='12'
              stroke='currentColor'
              strokeWidth='1.6'
              strokeLinecap='round'
            />
          </>
        ) : null}
        {variant === 'minimize' ? (
          <line
            x1='4'
            y1='8'
            x2='12'
            y2='8'
            stroke='currentColor'
            strokeWidth='1.8'
            strokeLinecap='round'
          />
        ) : null}
        {variant === 'maximize' ? (
          isExpanded ? (
            <rect
              x='4.5'
              y='4.5'
              width='7'
              height='7'
              rx='1.6'
              stroke='currentColor'
              strokeWidth='1.4'
              fill='none'
            />
          ) : (
            <>
              <line
                x1='8'
                y1='4'
                x2='8'
                y2='12'
                stroke='currentColor'
                strokeWidth='1.6'
                strokeLinecap='round'
              />
              <line
                x1='4'
                y1='8'
                x2='12'
                y2='8'
                stroke='currentColor'
                strokeWidth='1.6'
                strokeLinecap='round'
              />
            </>
          )
        ) : null}
      </svg>
    </button>
  );
};

export default TrafficLightButton;
