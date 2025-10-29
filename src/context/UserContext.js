import React, { createContext, useContext, useMemo, useReducer } from 'react';

const UserContext = createContext(null);

function reducer(state, action) {
  switch (action.type) {
    case 'SET_PROFILE':
      return { ...state, profile: { ...(state.profile || {}), ...(action.payload || {}) } };
    default:
      return state;
  }
}

export function UserProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, { profile: null });

  const api = useMemo(() => ({
    profile: state.profile,
    setProfile: (data) => dispatch({ type: 'SET_PROFILE', payload: data }),
  }), [state.profile]);

  return <UserContext.Provider value={api}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used inside <UserProvider>');
  return ctx;
}
