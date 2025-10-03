import { create } from 'zustand';
import type { AppConfig } from './configStore';
import {
  DEFAULT_PRIVACY_POLICY,
  DEFAULT_TERMS_OF_SERVICE,
} from '../constants/legal';

export interface LegalAcceptance {
  termsAccepted: boolean;
  privacyAccepted: boolean;
  termsAcceptedAt?: string;
  privacyAcceptedAt?: string;
}

export interface LegalStore {
  legalAcceptance: LegalAcceptance;
  termsContent: string;
  privacyContent: string;
  termsSource?: string;
  privacySource?: string;
  isLoadingContent: boolean;
  hasLoadedContent: boolean;
  hasAcceptedAll: () => boolean;
  acceptTerms: () => void;
  acceptPrivacy: () => void;
  acceptAll: () => void;
  reset: () => void;
  loadFromStorage: () => Promise<void>;
  saveToStorage: () => Promise<void>;
  loadContent: () => Promise<void>;
}

const defaultLegalAcceptance: LegalAcceptance = {
  termsAccepted: false,
  privacyAccepted: false,
};

const STORAGE_KEY = 'legal-acceptance';

export const useLegalStore = create<LegalStore>((set, get) => ({
  legalAcceptance: defaultLegalAcceptance,
  termsContent: DEFAULT_TERMS_OF_SERVICE,
  privacyContent: DEFAULT_PRIVACY_POLICY,
  termsSource: 'bundle',
  privacySource: 'bundle',
  isLoadingContent: false,
  hasLoadedContent: false,

  hasAcceptedAll: () => {
    const { legalAcceptance } = get();
    return legalAcceptance.termsAccepted && legalAcceptance.privacyAccepted;
  },

  acceptTerms: async () => {
    const now = new Date().toISOString();
    set((state) => ({
      legalAcceptance: {
        ...state.legalAcceptance,
        termsAccepted: true,
        termsAcceptedAt: now,
      },
    }));
    await get().saveToStorage();
  },

  acceptPrivacy: async () => {
    const now = new Date().toISOString();
    set((state) => ({
      legalAcceptance: {
        ...state.legalAcceptance,
        privacyAccepted: true,
        privacyAcceptedAt: now,
      },
    }));
    await get().saveToStorage();
  },

  acceptAll: async () => {
    const now = new Date().toISOString();
    set({
      legalAcceptance: {
        termsAccepted: true,
        privacyAccepted: true,
        termsAcceptedAt: now,
        privacyAcceptedAt: now,
      },
    });
    await get().saveToStorage();
  },

  reset: async () => {
    set({ legalAcceptance: defaultLegalAcceptance });
    localStorage.removeItem(STORAGE_KEY);

    if (window.desktop && typeof window?.desktop?.saveConfig === 'function') {
      try {
        const config = await window.desktop.loadConfig();
        if (config) {
          const updatedConfig: AppConfig = {
            ...config,
            legalAcceptance: defaultLegalAcceptance,
          };
          await window.desktop.saveConfig(updatedConfig as AppConfig);
        }
      } catch (_error) {}
    }
  },

  loadFromStorage: async () => {
    try {
      if (window.desktop && typeof window?.desktop?.loadConfig === 'function') {
        const result = await window.desktop.loadConfig();
        if (result?.legalAcceptance) {
          set({ legalAcceptance: result.legalAcceptance });
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(result.legalAcceptance)
          );
          return;
        }
      }

      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as LegalAcceptance;
        set({ legalAcceptance: parsed });
      }
    } catch (_error) {}
  },

  saveToStorage: async () => {
    const { legalAcceptance } = get();

    localStorage.setItem(STORAGE_KEY, JSON.stringify(legalAcceptance));

    if (window.desktop && typeof window?.desktop?.saveConfig === 'function') {
      try {
        const result = await window.desktop.loadConfig();
        if (result) {
          const updatedConfig: AppConfig = {
            ...result,
            legalAcceptance,
          };
          await window.desktop.saveConfig(updatedConfig as AppConfig);
        }
      } catch (_error) {}
    }
  },

  loadContent: async () => {
    const { isLoadingContent, hasLoadedContent } = get();
    if (isLoadingContent || hasLoadedContent) {
      return;
    }

    set({ isLoadingContent: true });
    try {
      const envConfig = await window?.desktop?.getEnvironmentConfig?.();
      const legal = envConfig?.legal;
      if (!legal) {
        set({ hasLoadedContent: true, isLoadingContent: false });
        return;
      }

      const nextTerms =
        typeof legal.termsMarkdown === 'string' && legal.termsMarkdown.trim().length > 0
          ? legal.termsMarkdown
          : DEFAULT_TERMS_OF_SERVICE;
      const nextPrivacy =
        typeof legal.privacyMarkdown === 'string' &&
        legal.privacyMarkdown.trim().length > 0
          ? legal.privacyMarkdown
          : DEFAULT_PRIVACY_POLICY;

      set({
        termsContent: nextTerms,
        privacyContent: nextPrivacy,
        termsSource: legal.termsSource || (legal.termsMarkdown ? 'env' : 'bundle'),
        privacySource:
          legal.privacySource || (legal.privacyMarkdown ? 'env' : 'bundle'),
        hasLoadedContent: true,
        isLoadingContent: false,
      });
    } catch (_error) {
      set({
        termsContent: DEFAULT_TERMS_OF_SERVICE,
        privacyContent: DEFAULT_PRIVACY_POLICY,
        termsSource: 'bundle',
        privacySource: 'bundle',
        hasLoadedContent: true,
      });
    } finally {
      set({ isLoadingContent: false });
    }
  },
}));
