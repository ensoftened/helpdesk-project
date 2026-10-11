// AuthContext: provides login/logout/register state to the entire React app.
//
// NEW CONCEPT: React Context — a way to share data across all components
// without passing props down through every level (prop drilling). Think of it
// like a bulletin board that any component can read from or write to.
//
// NEW CONCEPT: useReducer — a React hook for managing complex state. Instead of
// multiple useState calls, we define a reducer function that handles state
// transitions based on "action" objects. It's like a state machine.

import { createContext, useContext, useReducer, useEffect, ReactNode } from "react";
import * as api from "../api/client";
import type { User } from "../types";

// The shape of our auth state.
interface AuthState {
  user: User | null;       // The logged-in user (null = not logged in)
  loading: boolean;         // True while checking if the user's token is valid
  error: string | null;     // Error message from the last action
}

// Actions that can change the auth state.
type AuthAction =
  | { type: "LOADING" }
  | { type: "LOGIN_SUCCESS"; user: User }
  | { type: "LOGOUT" }
  | { type: "ERROR"; message: string }
  | { type: "CLEAR_ERROR" };

// The reducer: given the current state and an action, returns the new state.
function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "LOADING":
      return { ...state, loading: true, error: null };
    case "LOGIN_SUCCESS":
      return { user: action.user, loading: false, error: null };
    case "LOGOUT":
      return { user: null, loading: false, error: null };
    case "ERROR":
      return { ...state, loading: false, error: action.message };
    case "CLEAR_ERROR":
      return { ...state, error: null };
    default:
      return state;
  }
}

// The shape of our context value (what components will use).
interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  isAdmin: boolean;
  isAgent: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

// AuthProvider: wraps the entire app so any component can use useAuth().
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, {
    user: null, loading: true, error: null,
  });

  // On mount, check if there's a valid token in localStorage.
  useEffect(() => {
    const checkAuth = async () => {
      // Only try if we have a stored refresh token.
      if (!api.getAccessToken() && !localStorage.getItem("refreshToken")) {
        dispatch({ type: "LOGOUT" });
        return;
      }
      try {
        // Call /me to verify the token is still valid.
        const res = await api.getMe();
        dispatch({ type: "LOGIN_SUCCESS", user: res.data });
      } catch {
        // Token is invalid or expired — log out.
        api.clearTokens();
        dispatch({ type: "LOGOUT" });
      }
    };
    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    dispatch({ type: "LOADING" });
    try {
      const res = await api.login(email, password);
      api.setTokens(res.data.accessToken, res.data.refreshToken);
      dispatch({ type: "LOGIN_SUCCESS", user: res.data.user });
    } catch (err: any) {
      dispatch({ type: "ERROR", message: err.response?.data?.error?.message || "Login failed" });
      throw err;
    }
  };

  const register = async (name: string, email: string, password: string) => {
    dispatch({ type: "LOADING" });
    try {
      const res = await api.register(name, email, password);
      api.setTokens(res.data.accessToken, res.data.refreshToken);
      dispatch({ type: "LOGIN_SUCCESS", user: res.data.user });
    } catch (err: any) {
      dispatch({ type: "ERROR", message: err.response?.data?.error?.message || "Registration failed" });
      throw err;
    }
  };

  const logout = async () => {
    try { await api.logout(); } catch { /* ignore network errors */ }
    api.clearTokens();
    dispatch({ type: "LOGOUT" });
  };

  const clearError = () => dispatch({ type: "CLEAR_ERROR" });

  const value: AuthContextType = {
    ...state,
    login, register, logout, clearError,
    isAdmin: state.user?.role === "Admin",
    isAgent: state.user?.role === "Agent" || state.user?.role === "Admin",
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// useAuth: the hook any component calls to access auth state and functions.
export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}