/**
 * User profile interface for HCS-10 profiles
 */
export interface UserProfile {
  display_name?: string;
  alias?: string;
  bio?: string;
  profileImage?: string;
  type?: number;
  aiAgent?: {
    type: number;
    capabilities?: number[];
    model?: string;
    creator?: string;
  };
}