import React from 'react';
import { InscriptionSelect } from './InscriptionSelect';

interface AgentLogoSelectorProps {
  onChange: (value: string) => void;
  formData: string;
  network: 'mainnet' | 'testnet';
}

/**
 * AgentLogoSelector component that uses HCS-11 inscription for profile pictures
 * Follows the moonscape pattern for HCS-11 integration
 */
export function AgentLogoSelector({
  onChange,
  formData,
  network,
}: AgentLogoSelectorProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">Profile Picture</h3>
      <InscriptionSelect
        onChange={onChange}
        messageEnabled
        warningMessage="Please select a profile picture"
        formData={formData}
        introMessage="Select a profile picture"
        network={network}
        uploadMessage="Upload a profile picture"
      />
    </div>
  );
}