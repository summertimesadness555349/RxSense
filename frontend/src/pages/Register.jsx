import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { register as apiRegister } from '../services/api.js';
import Input, { Select } from '../components/ui/Input.jsx';
import Button from '../components/ui/Button.jsx';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', phone: '+880', password: '', confirmPassword: '', role: 'patient' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const { login } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Full name is required';
    if (!form.email.includes('@')) e.email = 'Valid email required';
    if (form.password.length < 6) e.password = 'Password must be at least 6 characters';
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    try {
      // TODO: Replace with actual API call
      const { user } = await apiRegister(form);
      login(user);
      addToast(`Account created! Welcome, ${user.name}!`, 'success');
      navigate('/dashboard');
    } catch {
      addToast('Registration failed. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Create your account</h2>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
        Join RxSense — your free, smart health companion
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Full Name"
          id="name"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="Rahim Uddin"
          error={errors.name}
          required
        />
        <Input
          label="Email Address"
          id="email"
          type="email"
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
          placeholder="rahim@example.com"
          error={errors.email}
          required
        />
        <Input
          label="Phone Number (Bangladesh)"
          id="phone"
          type="tel"
          value={form.phone}
          onChange={(e) => set('phone', e.target.value)}
          placeholder="+8801712345678"
        />
        <Select
          label="I am a..."
          id="role"
          value={form.role}
          onChange={(e) => set('role', e.target.value)}
        >
          <option value="patient">Patient</option>
          <option value="healthworker">Health Worker</option>
          <option value="doctor">Doctor</option>
        </Select>
        <Input
          label="Password"
          id="password"
          type="password"
          value={form.password}
          onChange={(e) => set('password', e.target.value)}
          placeholder="Min. 6 characters"
          error={errors.password}
          required
        />
        <Input
          label="Confirm Password"
          id="confirmPassword"
          type="password"
          value={form.confirmPassword}
          onChange={(e) => set('confirmPassword', e.target.value)}
          placeholder="Repeat password"
          error={errors.confirmPassword}
          required
        />

        <Button type="submit" loading={loading} className="w-full" size="lg">
          Create Account
        </Button>
      </form>

      <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-5">
        Already have an account?{' '}
        <Link to="/login" className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
