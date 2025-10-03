import React from 'react';
import {
  FiDollarSign,
  FiInfo,
  FiUser,
  FiFile,
  FiMessageCircle,
  FiCode,
  FiSettings,
  FiShield,
  FiTrash2,
  FiEdit,
  FiPlus,
  FiMinus,
  FiLock,
  FiUnlock,
  FiKey,
  FiPlay,
  FiPause,
  FiRefreshCw,
  FiGift,
  FiCalendar,
  FiDatabase,
  FiTarget,
} from 'react-icons/fi';

export const getTransactionIcon = (
  type: string
): { icon: React.ComponentType<{ className?: string }>; color: string } => {
  const typeToIconMap: Record<
    string,
    { icon: React.ComponentType<{ className?: string }>; color: string }
  > = {
    CRYPTOTRANSFER: { icon: FiDollarSign, color: 'brand-blue' },
    ACCOUNTCREATE: { icon: FiUser, color: 'brand-green' },
    ACCOUNTUPDATE: { icon: FiEdit, color: 'brand-purple' },
    ACCOUNTDELETE: { icon: FiTrash2, color: 'red-500' },
    APPROVEALLOWANCE: { icon: FiKey, color: 'brand-green' },
    DELETEALLOWANCE: { icon: FiTrash2, color: 'red-500' },

    TOKENCREATE: { icon: FiPlus, color: 'brand-green' },
    TOKENCREATION: { icon: FiPlus, color: 'brand-green' },
    TOKENMINT: { icon: FiPlus, color: 'brand-green' },
    TOKENBURN: { icon: FiMinus, color: 'red-500' },
    TOKENUPDATE: { icon: FiEdit, color: 'brand-purple' },
    TOKENDELETE: { icon: FiTrash2, color: 'red-500' },
    TOKENASSOCIATE: { icon: FiRefreshCw, color: 'brand-green' },
    TOKENDISSOCIATE: { icon: FiRefreshCw, color: 'red-500' },
    TOKENFREEZE: { icon: FiLock, color: 'blue-500' },
    TOKENUNFREEZE: { icon: FiUnlock, color: 'brand-green' },
    TOKENGRANTKYC: { icon: FiShield, color: 'brand-green' },
    TOKENREVOKEKYC: { icon: FiShield, color: 'red-500' },
    TOKENPAUSE: { icon: FiPause, color: 'orange-500' },
    TOKENUNPAUSE: { icon: FiPlay, color: 'brand-green' },
    TOKENWIPE: { icon: FiTrash2, color: 'red-600' },
    TOKENFEESCHEDULEUPDATE: { icon: FiSettings, color: 'brand-purple' },
    TOKENAIRDROP: { icon: FiGift, color: 'brand-green' },

    CONTRACTCALL: { icon: FiCode, color: 'brand-blue' },
    CONTRACTCREATE: { icon: FiPlus, color: 'brand-green' },
    CONTRACTUPDATE: { icon: FiEdit, color: 'brand-purple' },
    CONTRACTDELETE: { icon: FiTrash2, color: 'red-500' },

    FILECREATE: { icon: FiFile, color: 'brand-green' },
    FILEUPDATE: { icon: FiEdit, color: 'brand-purple' },
    FILEDELETE: { icon: FiTrash2, color: 'red-500' },
    FILEAPPEND: { icon: FiPlus, color: 'brand-blue' },

    TOPICCREATE: { icon: FiMessageCircle, color: 'brand-green' },
    TOPICUPDATE: { icon: FiEdit, color: 'brand-purple' },
    TOPICDELETE: { icon: FiTrash2, color: 'red-500' },
    CONSENSUSSUBMITMESSAGE: { icon: FiMessageCircle, color: 'brand-blue' },

    SCHEDULECREATE: { icon: FiCalendar, color: 'brand-green' },
    SCHEDULESIGN: { icon: FiKey, color: 'brand-blue' },
    SCHEDULEDELETE: { icon: FiTrash2, color: 'red-500' },

    PRNG: { icon: FiTarget, color: 'brand-purple' },
    FREEZE: { icon: FiLock, color: 'blue-500' },
    SYSTEMDELETE: { icon: FiDatabase, color: 'red-500' },
    SYSTEMUNDELETE: { icon: FiDatabase, color: 'brand-green' },
  };

  return typeToIconMap[type] || { icon: FiInfo, color: 'brand-blue' };
};