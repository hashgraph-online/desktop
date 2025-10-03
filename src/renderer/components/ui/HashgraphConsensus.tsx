import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface HashgraphConsensusProps {
  animated?: boolean;
  className?: string;
  opacity?: number;
}

const HashgraphConsensus: React.FC<HashgraphConsensusProps> = ({
  animated = false,
  className,
  opacity = 0.1,
}) => {
  const nodePositions = [
    { x: 20, y: 20 },
    { x: 80, y: 30 },
    { x: 60, y: 60 },
    { x: 25, y: 80 },
    { x: 85, y: 75 },
    { x: 10, y: 50 },
    { x: 90, y: 45 },
    { x: 45, y: 25 },
    { x: 70, y: 85 },
    { x: 40, y: 70 },
  ];

  return (
    <div className={cn('w-full h-full relative', className)} style={{ opacity }}>
      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {/* Background grid */}
        <defs>
          <pattern
            id="hashgraph-grid"
            patternUnits="userSpaceOnUse"
            width="10"
            height="10"
          >
            <path
              d="M 10 0 L 0 0 0 10"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.2"
            />
          </pattern>
        </defs>

        <rect
          width="100"
          height="100"
          fill="url(#hashgraph-grid)"
          className="text-blue-500/20 dark:text-blue-400/10"
        />

        {/* Connection lines */}
        {nodePositions.map((node, index) => (
          nodePositions.slice(index + 1).map((otherNode, otherIndex) => {
            const distance = Math.sqrt(
              Math.pow(node.x - otherNode.x, 2) + Math.pow(node.y - otherNode.y, 2)
            );

            // Only draw lines for nearby nodes to create a network effect
            if (distance < 30) {
              return (
                <motion.line
                  key={`${index}-${otherIndex}`}
                  x1={node.x}
                  y1={node.y}
                  x2={otherNode.x}
                  y2={otherNode.y}
                  stroke="currentColor"
                  strokeWidth="0.3"
                  className="text-purple-500/30 dark:text-purple-400/20"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={animated ? {
                    pathLength: [0, 1, 0],
                    opacity: [0, 0.8, 0],
                  } : {}}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    delay: (index + otherIndex) * 0.5,
                    ease: 'easeInOut',
                  }}
                />
              );
            }
            return null;
          })
        ))}

        {/* Nodes */}
        {nodePositions.map((node, index) => (
          <motion.circle
            key={index}
            cx={node.x}
            cy={node.y}
            r="1"
            fill="currentColor"
            className="text-green-500/50 dark:text-green-400/40"
            initial={{ scale: 0 }}
            animate={animated ? {
              scale: [0, 1.5, 1],
              opacity: [0.3, 1, 0.3],
            } : { scale: 1 }}
            transition={{
              duration: 3,
              repeat: Infinity,
              delay: index * 0.3,
              ease: 'easeInOut',
            }}
          />
        ))}

        {/* Data flow particles */}
        {animated && (
          <>
            {Array.from({ length: 5 }).map((_, index) => (
              <motion.circle
                key={`particle-${index}`}
                r="0.5"
                fill="currentColor"
                className="text-blue-500/60 dark:text-blue-400/50"
                initial={{ x: 0, y: 50, opacity: 0 }}
                animate={{
                  x: [0, 25, 50, 75, 100],
                  y: [50, 30, 60, 40, 50],
                  opacity: [0, 1, 1, 1, 0],
                }}
                transition={{
                  duration: 8,
                  repeat: Infinity,
                  delay: index * 2,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </>
        )}
      </svg>
    </div>
  );
};

export { HashgraphConsensus };