// Note: Auth store sync disabled during better-auth migration
// TODO: Re-implement if needed with better-auth

export const initializeAuthStoreSync = (reduxStore: any) => {
  console.log("🔄 Auth store sync disabled - using better-auth");
};

export const setUpdatingFromRedux = (value: boolean) => {
  // No-op during better-auth migration
};

export const cleanupAuthStoreSync = () => {
  console.log("🔄 Auth store sync cleanup - no-op during better-auth migration");
}; 