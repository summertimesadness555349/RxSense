import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { login as apiLogin, doctorLogin } from '../services/api.js';
import Input from '../components/ui/Input.jsx';
import Button from '../components/ui/Button.jsx';

export default function Login() {
  const [role, setRole] = useState('patient');
  const [email, setEmail] = useState('rahim@example.com');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let res;
      if (role === 'doctor') {
        res = await doctorLogin(email, password);
      } else {
        res = await apiLogin(email, password);
      }
      const { user, token } = res;
      login(user, token);
      addToast(`Welcome back, ${user.name}!`, 'success');
      navigate(user?.role === 'doctor' ? '/doctor/dashboard' : '/dashboard');
    } catch (err) {
      addToast(err.message || 'Invalid email or password.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Welcome back</h2>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
        Sign in to your RxSense account
      </p>

      {/* Role Switcher */}
      <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl mb-5">
        <button
          type="button"
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
            role === 'patient'
              ? 'bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
              : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
          onClick={() => {
            setRole('patient');
            setEmail('rahim@example.com');
          }}
        >
          Patient
        </button>
        <button
          type="button"
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
            role === 'doctor'
              ? 'bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
              : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
          onClick={() => {
            setRole('doctor');
            setEmail('');
          }}
        >
          Doctor
        </button>
      </div>

      {role === 'patient' ? (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 mb-5 text-xs text-blue-700 dark:text-blue-400">
          <strong>Demo credentials:</strong> rahim@example.com / password123
        </div>
      ) : (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 mb-5 text-xs text-blue-700 dark:text-blue-400">
          <strong>Demo credentials:</strong> Create a doctor account first in registration, then sign in.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={role === 'doctor' ? 'Username or Email' : 'Email Address'}
          id="email"
          type="text"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={role === 'doctor' ? 'doctor_username' : 'your@email.com'}
          required
          autoComplete="username"
        />
        <Input
          label="Password"
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          autoComplete="current-password"
        />

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <input type="checkbox" className="rounded border-gray-300 text-emerald-500" />
            Remember me
          </label>
          <button type="button" className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium">
            Forgot password?
          </button>
        </div>

        <Button type="submit" loading={loading} className="w-full" size="lg">
          Sign In
        </Button>
      </form>

      <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-5">
        Don't have an account?{' '}
        <Link to="/register" className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline">
          Create one for free
        </Link>
      </p>
    </div>
  );
}
