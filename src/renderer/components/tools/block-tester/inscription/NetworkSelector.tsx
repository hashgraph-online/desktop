import React, { useCallback } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../ui/select';
import { useInscriptionState, useSetNetworkType } from '../../../../stores/blockTesterStore';
import { cn } from '../../../../lib/utils';

interface NetworkSelectorProps {
  className?: string;
}

/**
 * Network selector component for testnet/mainnet selection
 * Persists selection in store and follows desktop app patterns
 */
const NetworkSelector: React.FC<NetworkSelectorProps> = ({ className }) => {
  const { networkType } = useInscriptionState();
  const setNetworkType = useSetNetworkType();

  const handleNetworkChange = useCallback((value: string) => {
    if (value && value !== networkType) {
      setNetworkType(value);
    }
  }, [networkType, setNetworkType]);

  // Ensure we always have a valid network type
  const currentNetwork = networkType || 'testnet';

  return (
    <Select value={currentNetwork} onValueChange={handleNetworkChange}>
      <SelectTrigger className={cn("w-32", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="testnet">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
            Testnet
          </div>
        </SelectItem>
        <SelectItem value="mainnet">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            Mainnet
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
};

export default NetworkSelector;