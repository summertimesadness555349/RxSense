import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('rxsense_user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem('rxsense_user');
      }
    }
    setLoading(false);
  }, []);

  const login = (userData, token) => {
    setUser(userData);
    localStorage.setItem('rxsense_user', JSON.stringify(userData));
    if (token) localStorage.setItem('rxsense_token', token);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('rxsense_user');
    localStorage.removeItem('rxsense_token');
    localStorage.removeItem('rxsense_access_token');

    localStorage.removeItem('rxsense_prescription_chats');
    localStorage.removeItem('rxsense_prescription_history');

    localStorage.removeItem('rxsense_report_chats');
    localStorage.removeItem('rxsense_report_history');

    localStorage.removeItem('rxsense_symptom_sessions');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
