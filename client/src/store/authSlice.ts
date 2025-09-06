import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Better Auth compatible user interface
export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  twoFactorEnabled?: boolean;
  emailVerified?: boolean;
  menuExpanded?: boolean;
  theme?: 'light' | 'dark';
  avatarUrl?: string | null;
}

export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

// Note: Authentication is now handled by better-auth
// Redux is used only for UI state management and user preferences

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<AuthUser | null>) => {
      state.user = action.payload;
      state.isAuthenticated = !!action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    updateMenuPreference: (state, action: PayloadAction<boolean>) => {
      if (state.user) {
        state.user.menuExpanded = action.payload;
      }
    },
    updateUser: (state, action: PayloadAction<Partial<AuthUser>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
    clearAuth: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.error = null;
    },
  },
});

export const {
  setUser,
  setLoading,
  setError,
  updateMenuPreference,
  updateUser,
  clearAuth,
} = authSlice.actions;
export default authSlice.reducer;
