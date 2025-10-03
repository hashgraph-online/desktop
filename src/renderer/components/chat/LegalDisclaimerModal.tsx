import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import { Button } from '../ui/Button';
import { FiAlertTriangle, FiExternalLink } from 'react-icons/fi';
import Typography from '../ui/Typography';

interface LegalDisclaimerModalProps {
  children: React.ReactNode;
}

export const LegalDisclaimerModal: React.FC<LegalDisclaimerModalProps> = ({
  children,
}) => {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className='max-w-4xl max-h-[80vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2 text-xl'>
            <FiAlertTriangle className='w-6 h-6 text-orange-500' />
            Terms of Use & Legal Disclaimer
          </DialogTitle>
          <DialogDescription>
            Please read this disclaimer carefully before using this software.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-6 text-sm'>
          <section>
            <Typography
              variant='h6'
              className='font-semibold mb-2 text-red-600 dark:text-red-400'
            >
              ⚠️ ALPHA SOFTWARE WARNING
            </Typography>
            <Typography
              variant='body2'
              className='text-gray-700 dark:text-gray-300 leading-relaxed'
            >
              This software is in <strong>ALPHA STAGE</strong> and is provided
              for testing and development purposes only. Alpha software is
              inherently unstable, incomplete, and may contain bugs, errors, or
              security vulnerabilities.
              <strong> Use this software entirely at your own risk.</strong>
            </Typography>
          </section>

          <section>
            <Typography variant='h6' className='font-semibold mb-2'>
              🤖 AI Assistant Limitations
            </Typography>
            <Typography
              variant='body2'
              className='text-gray-700 dark:text-gray-300 leading-relaxed mb-2'
            >
              This application uses artificial intelligence to provide
              information and assistance. Please be aware:
            </Typography>
            <ul className='list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300 ml-4'>
              <li>AI responses may be inaccurate, incomplete, or outdated</li>
              <li>AI cannot provide legal, financial, or investment advice</li>
              <li>All AI-generated content should be independently verified</li>
              <li>
                The AI may misinterpret your requests or provide unexpected
                results
              </li>
              <li>
                Always review and understand any transactions before execution
              </li>
            </ul>
          </section>

          <section>
            <Typography variant='h6' className='font-semibold mb-2'>
              ₿ Cryptocurrency & Blockchain Risks
            </Typography>
            <Typography
              variant='body2'
              className='text-gray-700 dark:text-gray-300 leading-relaxed mb-2'
            >
              This software interacts with the Hedera Hashgraph and handles
              cryptocurrency transactions:
            </Typography>
            <ul className='list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300 ml-4'>
              <li>
                <strong>Transactions are irreversible</strong> - Once confirmed,
                cryptocurrency transactions cannot be undone
              </li>
              <li>
                <strong>Loss of funds</strong> - Bugs, errors, or misuse may
                result in permanent loss of cryptocurrency
              </li>
              <li>
                <strong>Network risks</strong> - Blockchain networks may
                experience outages, forks, or security issues
              </li>
              <li>
                <strong>Private key security</strong> - You are solely
                responsible for securing your private keys
              </li>
              <li>
                <strong>Regulatory risks</strong> - Cryptocurrency regulations
                vary by jurisdiction and may change
              </li>
              <li>
                <strong>Market volatility</strong> - Cryptocurrency values are
                highly volatile and unpredictable
              </li>
            </ul>
          </section>

          <section>
            <Typography variant='h6' className='font-semibold mb-2'>
              🔒 Security & Privacy
            </Typography>
            <ul className='list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300 ml-4'>
              <li>
                <strong>Never share your private keys</strong> with anyone or
                any service
              </li>
              <li>
                This software stores sensitive data locally - secure your device
                accordingly
              </li>
              <li>
                Use strong, unique passwords and enable two-factor
                authentication where possible
              </li>
              <li>
                Be aware that blockchain transactions are publicly visible
              </li>
              <li>
                The developers cannot recover lost private keys or reverse
                transactions
              </li>
            </ul>
          </section>

          <section>
            <Typography variant='h6' className='font-semibold mb-2'>
              🚫 No Warranty
            </Typography>
            <Typography
              variant='body2'
              className='text-gray-700 dark:text-gray-300 leading-relaxed'
            >
              This software is provided "AS IS" without warranty of any kind,
              either express or implied, including but not limited to the
              implied warranties of merchantability, fitness for a particular
              purpose, or non-infringement. The developers make no
              representations or warranties regarding the accuracy, reliability,
              completeness, or timeliness of the software or its content.
            </Typography>
          </section>

          <section>
            <Typography variant='h6' className='font-semibold mb-2'>
              ⚖️ Limitation of Liability
            </Typography>
            <Typography
              variant='body2'
              className='text-gray-700 dark:text-gray-300 leading-relaxed'
            >
              In no event shall the developers, contributors, or affiliated
              parties be liable for any direct, indirect, incidental, special,
              consequential, or punitive damages, including but not limited to
              loss of profits, data, or cryptocurrency, arising out of or in
              connection with the use of this software, even if advised of the
              possibility of such damages.
            </Typography>
          </section>

          <section>
            <Typography variant='h6' className='font-semibold mb-2'>
              💰 Not Financial Advice
            </Typography>
            <Typography
              variant='body2'
              className='text-gray-700 dark:text-gray-300 leading-relaxed'
            >
              Nothing in this software constitutes financial, investment, legal,
              or tax advice. Any information provided is for educational and
              informational purposes only. Consult with qualified professionals
              before making any financial decisions. Past performance does not
              guarantee future results.
            </Typography>
          </section>

          <section>
            <Typography variant='h6' className='font-semibold mb-2'>
              📋 Legal Compliance
            </Typography>
            <Typography
              variant='body2'
              className='text-gray-700 dark:text-gray-300 leading-relaxed'
            >
              You are solely responsible for ensuring your use of this software
              complies with all applicable laws and regulations in your
              jurisdiction. Cryptocurrency laws vary significantly by location
              and are subject to change. Some jurisdictions may prohibit or
              restrict cryptocurrency activities.
            </Typography>
          </section>

          <section>
            <Typography variant='h6' className='font-semibold mb-2'>
              🔞 Age Requirement
            </Typography>
            <Typography
              variant='body2'
              className='text-gray-700 dark:text-gray-300 leading-relaxed'
            >
              You must be at least 18 years old (or the age of majority in your
              jurisdiction) to use this software. By using this software, you
              represent and warrant that you meet this age requirement.
            </Typography>
          </section>

          <section>
            <Typography variant='h6' className='font-semibold mb-2'>
              🔄 Updates & Changes
            </Typography>
            <Typography
              variant='body2'
              className='text-gray-700 dark:text-gray-300 leading-relaxed'
            >
              This disclaimer may be updated at any time without notice.
              Continued use of the software after any changes constitutes
              acceptance of the new terms. It is your responsibility to review
              this disclaimer periodically for updates.
            </Typography>
          </section>

          <section>
            <Typography variant='h6' className='font-semibold mb-2'>
              📧 Contact
            </Typography>
            <Typography
              variant='body2'
              className='text-gray-700 dark:text-gray-300 leading-relaxed'
            >
              If you have questions about this disclaimer or the software,
              please contact the development team through appropriate channels.
              However, note that support for alpha software may be limited.
            </Typography>
          </section>

          <section className='border-2 border-red-500 bg-red-50 dark:bg-red-950/20 p-4 rounded-lg'>
            <Typography
              variant='h6'
              className='font-semibold mb-2 text-red-700 dark:text-red-400'
            >
              🚨 FINAL WARNING
            </Typography>
            <Typography
              variant='body2'
              className='text-red-700 dark:text-red-300 leading-relaxed font-medium'
            >
              By using this alpha software, you acknowledge that you understand
              and accept all risks outlined above. You agree that you are using
              this software entirely at your own risk and that the developers
              shall not be held liable for any losses, damages, or issues that
              may arise from its use.
            </Typography>
          </section>

          <section className='text-center pt-4 border-t border-gray-200 dark:border-gray-700'>
            <Typography
              variant='caption'
              className='text-gray-500 dark:text-gray-400'
            >
              Software Version: Alpha • Last Updated:{' '}
              {new Date().toLocaleDateString()} •
              <Button variant='link' className='p-0 h-auto text-xs' asChild>
                <a
                  href='https://github.com/hashgraphonline/hashgraph-online'
                  target='_blank'
                  rel='noopener noreferrer'
                >
                  View Source Code <FiExternalLink className='w-3 h-3 ml-1' />
                </a>
              </Button>
            </Typography>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};
