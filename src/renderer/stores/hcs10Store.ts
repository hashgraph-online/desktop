import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StoredHCS10Profile } from '../../shared/schemas/hcs10';

interface HCS10State {
  profiles: StoredHCS10Profile[];
  selectedProfileId: string | null;
  isLoading: boolean;
  error: string | null;
  
  addProfile: (profile: StoredHCS10Profile) => void;
  updateProfile: (profileId: string, updates: Partial<StoredHCS10Profile>) => void;
  deleteProfile: (profileId: string) => void;
  setSelectedProfile: (profileId: string | null) => void;
  loadProfiles: () => Promise<void>;
  clearError: () => void;
}

/**
 * Store for managing HCS-10 profiles
 */
export const useHCS10Store = create<HCS10State>()(
  persist(
    (set, get) => ({
      profiles: [] as any[],
      selectedProfileId: null as any,
      isLoading: false,
      error: null as any,

      /**
       * Add a new profile
       */
      addProfile: (profile) => {
        set((state) => ({
          profiles: [...state.profiles, profile],
          selectedProfileId: profile.id
        }));
      },

      /**
       * Update an existing profile
       */
      updateProfile: (profileId, updates) => {
        set((state) => ({
          profiles: state.profiles.map((profile) =>
            profile.id === profileId
              ? { ...profile, ...updates, lastUpdated: new Date() }
              : profile
          )
        }));
      },

      /**
       * Delete a profile
       */
      deleteProfile: (profileId) => {
        set((state) => ({
          profiles: state.profiles.filter((profile) => profile.id !== profileId),
          selectedProfileId: state.selectedProfileId === profileId ? null : state.selectedProfileId
        }));
      },

      /**
       * Set the selected profile
       */
      setSelectedProfile: (profileId) => {
        set({ selectedProfileId: profileId });
      },

      /**
       * Load profiles from backend
       */
      loadProfiles: async () => {
        set({ isLoading: true, error: null });
        
        try {
          const result = await window.api.invoke('hcs10:getProfiles');
          
          if (result.success && result.data) {
            const profiles = result.data.map((profile: any) => ({
              ...profile,
              registeredAt: new Date(profile.registeredAt),
              lastUpdated: new Date(profile.lastUpdated)
            }));
            
            set({ profiles, isLoading: false });
          } else {
            set({ 
              error: result.error || 'Failed to load profiles', 
              isLoading: false 
            });
          }
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to load profiles', 
            isLoading: false 
          });
        }
      },

      /**
       * Clear error state
       */
      clearError: () => {
        set({ error: null });
      }
    }),
    {
      name: 'hcs10-profile-storage',
      partialize: (state) => ({
        profiles: state.profiles,
        selectedProfileId: state.selectedProfileId
      })
    }
  )
);

export const useHCS10Profiles = () => useHCS10Store((state) => state.profiles);
export const useSelectedHCS10Profile = () => {
  const selectedId = useHCS10Store((state) => state.selectedProfileId);
  const profiles = useHCS10Store((state) => state.profiles);
  return profiles.find((p) => p.id === selectedId);
};
export const useHCS10ProfileById = (profileId: string) => {
  const profiles = useHCS10Store((state) => state.profiles);
  return profiles.find((p) => p.id === profileId);
};