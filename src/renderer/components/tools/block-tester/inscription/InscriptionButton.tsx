import React from 'react';
import { HiLink } from 'react-icons/hi2';
import { Button } from '../../../ui/Button';
import {
  useInscriptionState,
  useInscribeBlock,
  useBlockTesterStore,
} from '../../../../stores/blockTesterStore';
import { WorkingBlock } from '../../../../types/block-tester.types';
import { cn } from '../../../../lib/utils';

interface InscriptionButtonProps {
  block: WorkingBlock | null;
  isValid: boolean;
  className?: string;
}

const InscriptionButton: React.FC<InscriptionButtonProps> = ({
  block,
  isValid,
  className,
}) => {
  const { isInscribing, inscriptionStatus } = useInscriptionState();
  const inscribeBlock = useInscribeBlock();
  const template = useBlockTesterStore((state) => state.template);

  const validForInscription = React.useMemo(() => {
    if (!block) return false;
    return (
      isValid &&
      block.name.trim() !== '' &&
      (block.description || '').trim() !== '' &&
      (template || '').trim() !== ''
    );
  }, [block, isValid, template]);

  const canInscribe = block && isValid && validForInscription && !isInscribing;

  const handleClick = async () => {
    if (!canInscribe || !block) return;
    await inscribeBlock(block);
  };

  const getButtonText = (): string => {
    if (!block) return 'No Block Selected';
    if (!isValid) return 'Block Invalid';
    if (isInscribing) {
      switch (inscriptionStatus) {
        case 'validating':
          return 'Validating...';
        case 'submitting':
          return 'Inscribing...';
        default:
          return 'Processing...';
      }
    }
    return 'Inscribe';
  };

  const getButtonVariant = () => {
    if (!canInscribe) return 'outline';
    return 'default';
  };

  return (
    <Button
      variant={getButtonVariant()}
      size='sm'
      disabled={!canInscribe}
      onClick={handleClick}
      className={cn(
        canInscribe &&
          'bg-gradient-to-r from-hgo-blue to-hgo-green text-white hover:opacity-90',
        'transition-all duration-200',
        className
      )}
    >
      <HiLink className='w-4 h-4' />
      {getButtonText()}
    </Button>
  );
};

export default InscriptionButton;
