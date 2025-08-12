import { useState, useEffect, ReactNode } from 'react';
import { useLegalStore } from '../../stores/legalStore';
import { TermsModal } from './TermsModal';
import { PrivacyModal } from './PrivacyModal';
import Typography from './Typography';
import Logo from './Logo';
import { FiCheck } from 'react-icons/fi';

interface LegalGuardProps {
  children: ReactNode;
}

/**
 * Legal Guard component that enforces acceptance of Terms of Service and Privacy Policy
 * on first launch before allowing access to the application
 */
export const LegalGuard = ({ children }: LegalGuardProps) => {
  const {
    legalAcceptance,
    hasAcceptedAll,
    acceptTerms,
    acceptPrivacy,
    loadFromStorage,
  } = useLegalStore();

  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      await loadFromStorage();
      setHasInitialized(true);
    };
    loadData();
  }, [loadFromStorage]);

  useEffect(() => {
    if (hasInitialized) {
      if (!legalAcceptance.termsAccepted) {
        setIsTermsModalOpen(true);
      } else if (!legalAcceptance.privacyAccepted) {
        setIsPrivacyModalOpen(true);
      }
    }
  }, [hasInitialized, legalAcceptance]);

  const handleAcceptTerms = async () => {
    await acceptTerms();
    setIsTermsModalOpen(false);
    setTimeout(() => {
      setIsPrivacyModalOpen(true);
    }, 300);
  };

  const handleAcceptPrivacy = async () => {
    await acceptPrivacy();
    setIsPrivacyModalOpen(false);
  };

  const handleDeclineTerms = () => {
    alert('You must accept the Terms of Service to use this application.');
  };

  const handleDeclinePrivacy = () => {
    alert('You must accept the Privacy Policy to use this application.');
  };

  if (!hasInitialized) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900'>
        <div className='text-center'>
          <div className='w-12 h-12 border-3 border-[#5599fe] border-t-transparent rounded-full animate-spin mx-auto mb-4'></div>
        </div>
      </div>
    );
  }

  if (!hasAcceptedAll()) {
    return (
      <div className='min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900'>
        <div className='min-h-screen flex items-center justify-center p-8'>
          <div className='max-w-2xl w-full'>
            <div className='text-center mb-12'>
              <div className='w-24 h-24 bg-gradient-to-br from-[#a679f0] via-[#5599fe] to-[#48df7b] rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg p-5'>
                <Logo size='lg' />
              </div>
              <Typography
                variant='h1'
                className='text-4xl font-bold bg-gradient-to-r from-[#a679f0] via-[#5599fe] to-[#48df7b] bg-clip-text text-transparent mb-4'
              >
                Welcome to Hashgraph Online
              </Typography>
              <Typography
                variant='body1'
                className='text-lg text-gray-600 dark:text-gray-400'
              >
                Your AI assistant for Hedera - transactions, tokens, HCS standards, and more
              </Typography>
            </div>

            <div className='bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-gray-800'>
              <div className='space-y-4 mb-8'>
                <Typography
                  variant='body1'
                  className='text-gray-700 dark:text-gray-300 text-center'
                >
                  Before you can continue, please review and accept our legal
                  agreements:
                </Typography>

                <div className='space-y-3'>
                  <div className='flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg'>
                    <div
                      className={`w-5 h-5 rounded-full ${
                        legalAcceptance.termsAccepted
                          ? 'bg-green-500'
                          : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      {legalAcceptance.termsAccepted && (
                        <FiCheck className='w-5 h-5 text-white' />
                      )}
                    </div>
                    <span
                      className={`flex-1 ${
                        legalAcceptance.termsAccepted
                          ? 'text-green-600 dark:text-green-400 font-medium'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      Terms of Service
                    </span>
                  </div>

                  <div className='flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg'>
                    <div
                      className={`w-5 h-5 rounded-full ${
                        legalAcceptance.privacyAccepted
                          ? 'bg-green-500'
                          : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      {legalAcceptance.privacyAccepted && (
                        <FiCheck className='w-5 h-5 text-white' />
                      )}
                    </div>
                    <span
                      className={`flex-1 ${
                        legalAcceptance.privacyAccepted
                          ? 'text-green-600 dark:text-green-400 font-medium'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      Privacy Policy
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsTermsModalOpen(true)}
                className='w-full py-4 px-6 bg-gradient-to-r from-[#a679f0] to-[#5599fe] hover:from-[#9568e0] hover:to-[#4488ee] text-white font-medium rounded-xl transition-all transform hover:scale-[1.02] shadow-lg'
              >
                {!legalAcceptance.termsAccepted
                  ? 'Review Legal Agreements'
                  : 'Continue to App'}
              </button>
            </div>
          </div>
        </div>

        <TermsModal
          open={isTermsModalOpen}
          onOpenChange={setIsTermsModalOpen}
          onAccept={handleAcceptTerms}
          onDecline={handleDeclineTerms}
        />

        <PrivacyModal
          open={isPrivacyModalOpen}
          onOpenChange={setIsPrivacyModalOpen}
          onAccept={handleAcceptPrivacy}
          onDecline={handleDeclinePrivacy}
        />
      </div>
    );
  }

  return <>{children}</>;
};
