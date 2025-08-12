import { create } from 'zustand';

export interface LegalAcceptance {
  termsAccepted: boolean;
  privacyAccepted: boolean;
  termsAcceptedAt?: string;
  privacyAcceptedAt?: string;
}

export interface LegalStore {
  legalAcceptance: LegalAcceptance;
  hasAcceptedAll: () => boolean;
  acceptTerms: () => void;
  acceptPrivacy: () => void;
  acceptAll: () => void;
  reset: () => void;
  loadFromStorage: () => Promise<void>;
  saveToStorage: () => Promise<void>;
}

const defaultLegalAcceptance: LegalAcceptance = {
  termsAccepted: false,
  privacyAccepted: false,
};

const STORAGE_KEY = 'legal-acceptance';

export const useLegalStore = create<LegalStore>((set, get) => ({
  legalAcceptance: defaultLegalAcceptance,

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
    
    if (window.electron && typeof window.electron.saveConfig === 'function') {
      try {
        const config = await window.electron.loadConfig();
        if (config && config.success) {
          const updatedConfig = {
            ...config.config,
            legalAcceptance: defaultLegalAcceptance
          };
          await window.electron.saveConfig(updatedConfig as unknown as Record<string, unknown>);
        }
      } catch (error) {
        console.error('Failed to reset legal acceptance in config:', error);
      }
    }
  },

  loadFromStorage: async () => {
    try {
      if (window.electron && typeof window.electron.loadConfig === 'function') {
        const result = await window.electron.loadConfig();
        if (result && result.success && result.config?.legalAcceptance) {
          set({ legalAcceptance: result.config.legalAcceptance });
          localStorage.setItem(STORAGE_KEY, JSON.stringify(result.config.legalAcceptance));
          return;
        }
      }
      
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as LegalAcceptance;
        set({ legalAcceptance: parsed });
      }
    } catch (error) {
      console.error('Failed to load legal acceptance:', error);
    }
  },

  saveToStorage: async () => {
    const { legalAcceptance } = get();
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(legalAcceptance));
    
    if (window.electron && typeof window.electron.saveConfig === 'function') {
      try {
        const result = await window.electron.loadConfig();
        if (result && result.success) {
          const updatedConfig = {
            ...result.config,
            legalAcceptance
          };
          await window.electron.saveConfig(updatedConfig as unknown as Record<string, unknown>);
        }
      } catch (error) {
        console.error('Failed to save legal acceptance to config:', error);
      }
    }
  },
}));
