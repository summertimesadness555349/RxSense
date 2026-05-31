import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { updateDoctorProfile, changeDoctorPassword } from '../services/api.js';
import Button from '../components/ui/Button.jsx';
import Input, { Select } from '../components/ui/Input.jsx';
import SpecialtyInput from '../components/ui/SpecialtyInput.jsx';

export default function DoctorSettings() {
  const { user, login } = useAuth();
  const { addToast } = useToast();

  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    specialty: Array.isArray(user?.specialty) 
      ? user.specialty 
      : (user?.specialty ? [user.specialty] : []),
    gender: user?.gender || 'male',
    username: user?.username || '',
    email: user?.email || ''
  });
  
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!profileForm.name.trim() || !profileForm.username.trim() || !profileForm.email.trim()) {
      addToast('Name, username, and email are required', 'warning');
      return;
    }
    if (!profileForm.specialty || profileForm.specialty.length === 0) {
      addToast('At least one specialty is required', 'warning');
      return;
    }

    setProfileLoading(true);
    try {
      const updated = await updateDoctorProfile(user.id, profileForm);
      // login helper in AuthContext merges/updates stored user object; token preserved via context
      login({ ...user, ...updated });
      addToast('Profile updated successfully!', 'success');
    } catch (err) {
      addToast(err.message || 'Failed to update profile', 'error');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!passwordForm.oldPassword || !passwordForm.newPassword) {
      addToast('Please fill in both old and new passwords', 'warning');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      addToast('New password must be at least 6 characters long', 'warning');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      addToast('New passwords do not match', 'warning');
      return;
    }

    setPasswordLoading(true);
    try {
      await changeDoctorPassword(user.id, {
        oldPassword: passwordForm.oldPassword,
        newPassword: passwordForm.newPassword
      });
      addToast('Password changed successfully!', 'success');
      setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      addToast(err.message || 'Failed to change password', 'error');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <motion.div 
        initial={{ opacity: 0, y: -10 }} 
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Profile Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Manage your physician profile details and account security.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile Card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-sm space-y-4"
        >
          <h2 className="text-base font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-850 pb-2">
            Personal Details
          </h2>

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <Input
              label="Full Name"
              id="name"
              value={profileForm.name}
              onChange={(e) => setProfileForm(p => ({ ...p, name: e.target.value }))}
              required
            />
            <SpecialtyInput
              label="Specialties / Areas of Expertise"
              value={profileForm.specialty}
              onChange={(val) => setProfileForm(p => ({ ...p, specialty: val }))}
            />
            <Input
              label="Username"
              id="username"
              value={profileForm.username}
              onChange={(e) => setProfileForm(p => ({ ...p, username: e.target.value }))}
              required
            />
            <Input
              label="Email Address"
              id="email"
              type="email"
              value={profileForm.email}
              onChange={(e) => setProfileForm(p => ({ ...p, email: e.target.value }))}
              required
            />
            <Select
              label="Gender"
              id="gender"
              value={profileForm.gender}
              onChange={(e) => setProfileForm(p => ({ ...p, gender: e.target.value }))}
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </Select>

            <Button type="submit" loading={profileLoading} className="w-full">
              Save Changes
            </Button>
          </form>
        </motion.div>

        {/* Change Password Card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-sm space-y-4"
        >
          <h2 className="text-base font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-850 pb-2">
            Change Password
          </h2>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <Input
              label="Current Password"
              id="oldPassword"
              type="password"
              value={passwordForm.oldPassword}
              onChange={(e) => setPasswordForm(p => ({ ...p, oldPassword: e.target.value }))}
              placeholder="••••••••"
              required
            />
            <Input
              label="New Password"
              id="newPassword"
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm(p => ({ ...p, newPassword: e.target.value }))}
              placeholder="Min. 6 characters"
              required
            />
            <Input
              label="Confirm New Password"
              id="confirmPassword"
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm(p => ({ ...p, confirmPassword: e.target.value }))}
              placeholder="••••••••"
              required
            />

            <Button type="submit" loading={passwordLoading} className="w-full">
              Update Password
            </Button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
