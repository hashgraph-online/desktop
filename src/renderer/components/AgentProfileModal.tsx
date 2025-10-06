import React, { useState, useCallback, useEffect } from 'react';
import {
  FiX,
  FiRefreshCw,
  FiAlertTriangle,
  FiUser,
  FiHash,
  FiCopy,
  FiExternalLink,
  FiLink,
  FiStar,
  FiCpu,
  FiCamera,
  FiMic,
  FiFilm,
  FiCode,
  FiGlobe,
  FiBarChart2,
  FiDatabase,
  FiShare2,
  FiTrendingUp,
  FiActivity,
  FiShield,
  FiCheckCircle,
  FiAlertTriangle as FiAlert,
  FiBriefcase,
  FiLock,
  FiUsers,
  FiZap,
} from 'react-icons/fi';
import { FaTwitter, FaGithub, FaGlobe, FaDiscord } from 'react-icons/fa';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/Button';
import { Badge } from './ui/badge';
import Typography from './ui/Typography';
import { toast } from 'sonner';
import { gradients } from '../lib/styles';
import { useHRLImageUrl } from '../hooks/useHRLImageUrl';
import { NetworkType } from '@hashgraphonline/standards-sdk';
import { invokeCommand } from '../tauri/ipc';

interface ProfileModalProps {
  agent: AgentProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onConnect: (accountId: string) => void;
}

interface AgentProfile {
  id?: string;
  accountId: string;
  profile?: any;
  metadata?: any;
  rating?: number;
  ratingCount?: number;
  network?: string;
  createdAt?: string | Date;
}

interface SocialLink {
  platform: string;
  url?: string;
  handle?: string;
}

const capabilityIconMap: {
  [key: number]: {
    icon: React.ComponentType<{ className?: string }>;
    description: string;
  };
} = {
  0: { icon: FiCpu, description: 'Text Generation' },
  1: { icon: FiCamera, description: 'Image Generation' },
  2: { icon: FiMic, description: 'Audio Generation' },
  3: { icon: FiFilm, description: 'Video Generation' },
  4: { icon: FiCode, description: 'Code Generation' },
  5: { icon: FiGlobe, description: 'Language Translation' },
  6: { icon: FiBarChart2, description: 'Summarization & Content Extraction' },
  7: { icon: FiDatabase, description: 'Knowledge Retrieval & Reasoning' },
  8: { icon: FiShare2, description: 'Data Integration & Visualization' },
  9: { icon: FiTrendingUp, description: 'Market Intelligence' },
  10: { icon: FiActivity, description: 'Transaction Analytics' },
  11: { icon: FiShield, description: 'Smart Contract Audit' },
  12: { icon: FiCheckCircle, description: 'Governance Facilitation' },
  13: { icon: FiAlert, description: 'Security Monitoring' },
  14: { icon: FiBriefcase, description: 'Compliance & Regulatory Analysis' },
  15: { icon: FiLock, description: 'Fraud Detection & Prevention' },
  16: { icon: FiUsers, description: 'Multi-Agent Coordination' },
  17: { icon: FiLink, description: 'API Integration & Orchestration' },
  18: { icon: FiZap, description: 'Workflow Automation' },
};

/**
 * Component for displaying a field with copy functionality
 */
const MetadataField: React.FC<{
  label: string;
  value: string;
  icon?: React.ReactNode;
  copyButton?: boolean;
  externalLink?: string;
}> = ({ label, value, icon, copyButton = true, externalLink }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy');
    }
  }, [value]);

  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 flex items-center justify-between">
      <div className="flex items-center space-x-3 min-w-0 flex-1">
        {icon ? <div className="text-gray-500 dark:text-gray-400">{icon}</div> : null}
        <div className="min-w-0 flex-1">
          <Typography variant="caption" className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            {label}
          </Typography>
          <Typography
            variant="body2"
            className="text-sm font-mono text-gray-900 dark:text-gray-100 truncate"
          >
            {value}
          </Typography>
        </div>
      </div>
      <div className="flex items-center space-x-2 ml-2">
        {externalLink && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(externalLink, '_blank')}
            className="h-8 w-8 p-0"
          >
            <FiExternalLink className="h-4 w-4" />
          </Button>
        )}
        {copyButton && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-8 w-8 p-0"
          >
            {copied ? (
              <span className="text-xs text-green-500">✓</span>
            ) : (
              <FiCopy className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
};

/**
 * Agent Profile Modal component
 */
export const AgentProfileModal: React.FC<ProfileModalProps> = ({
  agent,
  isOpen,
  onClose,
  onConnect,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);

  const agentData = agent || null;
  const { metadata, accountId } = agentData || {};
  const {
    name,
    description,
    logo,
    profileImage,
    socials,
    bio,
    display_name,
    alias,
    aiAgent,
    inboundTopicId,
  } = metadata || {};

  const displayName = display_name || alias || name || 'Unknown Agent';
  const rawAvatarUrl = profileImage || logo;
  const capabilities = aiAgent?.capabilities || [];
  const rating = agentData?.rating || 0;
  const ratingCount = agentData?.ratingCount || 0;
  const network = agentData?.network === 'testnet' ? 'testnet' : 'mainnet';

  const { resolvedUrl: avatarUrl, isLoading: imageLoading, error: imageError } = useHRLImageUrl(
    rawAvatarUrl || '',
    network as NetworkType
  );

  const fetchFullProfile = useCallback(async () => {
    if (!agentData?.accountId) return;

    setIsLoading(true);
    try {
      const result = await invokeCommand<AgentProfile | null>(
        'hcs10_get_agent_profile',
        {
          accountId: agentData.accountId,
        }
      );

      if (result.success && result.data) {
        setProfileData(result.data);
      } else {
        toast.error('Failed to load full profile');
      }
    } catch (error) {
      toast.error('Error loading profile');
    } finally {
      setIsLoading(false);
    }
  }, [agentData?.accountId]);

  useEffect(() => {
    if (isOpen && agentData) {
      fetchFullProfile();
    }
  }, [isOpen, agentData, fetchFullProfile]);

  if (!agentData) return null;

  const SocialsSection = () => {
    if (!socials) return null;

    const socialLinks = Array.isArray(socials) ? socials : [socials];
    
    return (
      <div className="flex justify-center space-x-4 mb-6">
        {socialLinks.map((social: SocialLink, index: number) => {
          let icon = <FaGlobe className="w-5 h-5" />;
          let url = social.url || social.handle;

          if (!url) return null;

          if (social.platform === 'twitter' || social.platform === 'x') {
            icon = <FaTwitter className="w-5 h-5" />;
            if (!url.includes('http')) {
              url = `https://twitter.com/${url.replace('@', '')}`;
            }
          } else if (social.platform === 'github') {
            icon = <FaGithub className="w-5 h-5" />;
            if (!url.includes('http')) {
              url = `https://github.com/${url}`;
            }
          } else if (social.platform === 'discord') {
            icon = <FaDiscord className="w-5 h-5" />;
          }

          return (
            <Button
              key={index}
              variant="ghost"
              size="sm"
              onClick={() => window.open(url, '_blank')}
              className="h-10 w-10 p-0 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              {icon}
            </Button>
          );
        })}
      </div>
    );
  };

  const CapabilitiesSection = () => {
    if (!capabilities.length) return null;

    return (
      <div className="mb-6">
        <Typography variant="h4" className="text-lg font-semibold mb-3 text-center">
          Capabilities
        </Typography>
        <div className="flex flex-wrap gap-2 justify-center">
          {capabilities.map((capabilityId: number) => {
            const capabilityInfo = capabilityIconMap[capabilityId];
            const IconComponent = capabilityInfo?.icon || FiUser;
            const description = capabilityInfo?.description || `Capability ${capabilityId}`;

            return (
              <Badge
                key={capabilityId}
                variant="outline"
                className="bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-300 px-3 py-1"
                title={description}
              >
                <IconComponent className="h-4 w-4 mr-2" />
                {description}
              </Badge>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900">
        <DialogHeader>
          <DialogTitle className="sr-only">Agent Profile</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center pt-6">
          <div className="relative mb-6">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center ${
              avatarUrl ? '' : gradients.primary
            } text-white overflow-hidden`}>
              {imageLoading ? (
                <FiRefreshCw className="animate-spin h-8 w-8 text-white" />
              ) : avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={`${displayName} avatar`}
                  className="w-24 h-24 object-cover"
                  onError={() => {
                  }}
                />
              ) : (
                <span className="text-2xl font-bold">
                  {displayName.charAt(0)}
                </span>
              )}
            </div>
            {imageError && (
              <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
                <FiAlertTriangle className="h-4 w-4 text-amber-500" title={imageError} />
              </div>
            )}
          </div>

          <Typography variant="h2" className="text-2xl font-bold mb-2 text-center">
            {displayName}
          </Typography>

          {rating > 0 && (
            <div className="flex items-center space-x-2 mb-4">
              <div className="flex items-center space-x-1">
                <FiStar className="h-4 w-4 text-yellow-400 fill-current" />
                <span className="text-sm font-medium">{rating.toFixed(1)}</span>
                <span className="text-sm text-gray-500">({ratingCount} reviews)</span>
              </div>
              <Badge variant="outline" className="ml-2">
                {network}
              </Badge>
            </div>
          )}

          {(description || bio) && (
            <Typography
              variant="body1"
              className="text-gray-600 dark:text-gray-300 text-center mb-6 max-w-lg leading-relaxed"
            >
              {description || bio}
            </Typography>
          )}

          <SocialsSection />

          <CapabilitiesSection />

          <div className="w-full space-y-3 mb-6">
            <MetadataField
              label="Account ID"
              value={accountId || ''}
              icon={<FiUser className="h-5 w-5" />}
              externalLink={`https://hashscan.io/${agent?.network === 'testnet' ? 'testnet/' : ''}account/${accountId}`}
            />

            {inboundTopicId && (
              <MetadataField
                label="Inbound Topic ID"
                value={inboundTopicId}
                icon={<FiHash className="h-5 w-5" />}
                externalLink={`https://hashscan.io/${agent?.network === 'testnet' ? 'testnet/' : ''}topic/${inboundTopicId}`}
              />
            )}

            {profileData?.outboundTopicId && (
              <MetadataField
                label="Outbound Topic ID"
                value={profileData.outboundTopicId}
                icon={<FiHash className="h-5 w-5" />}
                externalLink={`https://hashscan.io/${agent?.network === 'testnet' ? 'testnet/' : ''}topic/${profileData.outboundTopicId}`}
              />
            )}

            {aiAgent?.creator && (
              <MetadataField
                label="Creator"
                value={aiAgent.creator}
                icon={<FiUser className="h-5 w-5" />}
                copyButton={false}
              />
            )}
          </div>

          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <FiRefreshCw className="animate-spin h-5 w-5 text-purple-600 mr-2" />
              <Typography variant="body2">Loading additional profile data...</Typography>
            </div>
          )}

          <div className="flex space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700 w-full justify-center">
            <Button
              variant="outline"
              onClick={onClose}
              className="px-6"
            >
              Close
            </Button>
            <Button
              onClick={() => onConnect(accountId || '')}
              className={`px-6 ${gradients.primary} text-white hover:opacity-90`}
            >
              <FiLink className="mr-2 h-4 w-4" />
              Connect
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AgentProfileModal;
