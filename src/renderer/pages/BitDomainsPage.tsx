import React from 'react';
import { BitDomainRegistration } from '../components/bit-domains/BitDomainRegistration';

const BitDomainsPage: React.FC = () => {
  return (
    <div className='h-full w-full overflow-hidden'>
      <BitDomainRegistration />
    </div>
  );
};

export default BitDomainsPage;
