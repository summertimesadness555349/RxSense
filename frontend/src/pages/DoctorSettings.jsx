import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CalendarClock, Clock, Lock, Users, Building2, Plus, User,
  Stethoscope, UserCircle, Shield, Save, Eye, EyeOff, CheckCircle2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import {
  updateDoctorProfile,
  changeDoctorPassword,
  updateDoctorDailyLimit,
  getDoctorAvailability,
  setDoctorAvailability,
  getHospitalsList,
  addDoctorAffiliation,
  getDoctorAffiliations,
} from '../services/api.js';
import Button from '../components/ui/Button.jsx';
import Input, { Select } from '../components/ui/Input.jsx';
import SpecialtyInput from '../components/ui/SpecialtyInput.jsx';

const todayInputValue = () => new Date().toISOString().slice(0, 10);
const normalizeTime = (value) => (value ? String(value).slice(0, 5) : '');

const sectionVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.35 } }),
};

function SectionCard({ icon: Icon, title, subtitle, index, children }) {
  return (
    <motion.div
      custom={index}
      initial="hidden"
      animate="visible"
      variants={sectionVariants}
      className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl shadow-sm overflow-hidden"
    >
      <div className="flex items-center gap-3 px-6 pt-5 pb-3 border-b border-gray-100 dark:border-gray-800">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">{title}</h2>
          {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
        </div>
      </div>
      <div className="px-6 py-5">{children}</div>
    </motion.div>
  );
}

export default function DoctorSettings() {
  const { user, login } = useAuth();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState('profile');

  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    specialty: Array.isArray(user?.specialty)
      ? user.specialty
      : (user?.specialty ? [user.specialty] : []),
    gender: user?.gender || 'male',
    username: user?.username || '',
    email: user?.email || ''
  });
  const [profileLoading, setProfileLoading] = useState(false);

  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '', newPassword: '', confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState({ old: false, new: false, confirm: false });
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [limitForm, setLimitForm] = useState({
    dailyPatientLimit: user?.daily_patient_limit || 30,
  });
  const [limitLoading, setLimitLoading] = useState(false);

  const [availabilityForm, setAvailabilityForm] = useState({
    date: todayInputValue(),
    startTime: '09:00',
    endTime: '17:00',
    dailyLimit: '',
  });
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);

  const [hospitals, setHospitals] = useState([]);
  const [affiliations, setAffiliations] = useState([]);
  const [hospitalsLoading, setHospitalsLoading] = useState(false);
  const [affiliationForm, setAffiliationForm] = useState({ hospitalId: '', role: '', isPrimary: false });
  const [affiliationSaving, setAffiliationSaving] = useState(false);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!profileForm.name.trim() || !profileForm.username.trim() || !profileForm.email.trim()) {
      addToast('Name, username, and email are required', 'warning'); return;
    }
    if (!profileForm.specialty?.length) {
      addToast('At least one specialty is required', 'warning'); return;
    }
    setProfileLoading(true);
    try {
      const updated = await updateDoctorProfile(user.id, profileForm);
      login({ ...user, ...updated }, localStorage.getItem('rxsense_token'));
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
      addToast('Please fill in both old and new passwords', 'warning'); return;
    }
    if (passwordForm.newPassword.length < 6) {
      addToast('New password must be at least 6 characters long', 'warning'); return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      addToast('New passwords do not match', 'warning'); return;
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

  const handleUpdateLimit = async (e) => {
    e.preventDefault();
    const limitValue = Number(limitForm.dailyPatientLimit);
    if (!Number.isFinite(limitValue) || limitValue < 1) {
      addToast('Daily patient limit must be a positive number', 'warning'); return;
    }
    setLimitLoading(true);
    try {
      const result = await updateDoctorDailyLimit(limitValue);
      login({ ...user, ...result.doctor }, localStorage.getItem('rxsense_token'));
      const msg = result.effectiveDate
        ? `Daily limit updated. Active from ${result.effectiveDate} onwards.`
        : `Daily limit updated. Active immediately.`;
      addToast(msg, 'success');
    } catch (err) {
      addToast(err.message || 'Failed to update scheduling', 'error');
    } finally {
      setLimitLoading(false);
    }
  };

  const loadAvailability = async (date) => {
    if (!user?.id || !date) return;
    setAvailabilityLoading(true);
    try {
      const availability = await getDoctorAvailability(date);
      if (availability) {
        setAvailabilityForm((prev) => ({
          ...prev,
          date,
          startTime: normalizeTime(availability.start_time) || prev.startTime,
          endTime: normalizeTime(availability.end_time) || prev.endTime,
          dailyLimit: availability.daily_limit == null ? '' : String(availability.daily_limit),
        }));
      } else {
        setAvailabilityForm((prev) => ({ ...prev, date, dailyLimit: '' }));
      }
    } catch (err) {
      addToast(err.message || 'Failed to load availability', 'error');
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const handleUpdateAvailability = async (e) => {
    e.preventDefault();
    if (!availabilityForm.date) { addToast('Select a date first', 'warning'); return; }
    if (!availabilityForm.startTime || !availabilityForm.endTime) {
      addToast('Start and end time are required', 'warning'); return;
    }
    setAvailabilitySaving(true);
    try {
      const result = await setDoctorAvailability({
        date: availabilityForm.date,
        startTime: availabilityForm.startTime,
        endTime: availabilityForm.endTime,
        dailyLimit: availabilityForm.dailyLimit,
      });
      addToast(result.message || 'Availability updated', 'success');
      await loadAvailability(availabilityForm.date);
    } catch (err) {
      addToast(err.message || 'Failed to update availability', 'error');
    } finally {
      setAvailabilitySaving(false);
    }
  };

  const loadHospitals = async () => {
    setHospitalsLoading(true);
    try {
      const [hospitalsList, userAffiliations] = await Promise.all([
        getHospitalsList(),
        getDoctorAffiliations(user?.id),
      ]);
      setHospitals(hospitalsList || []);
      setAffiliations(userAffiliations || []);
    } catch (err) {
      addToast(err.message || 'Failed to load hospital data', 'error');
    } finally {
      setHospitalsLoading(false);
    }
  };

  const handleAddAffiliation = async (e) => {
    e.preventDefault();
    if (!affiliationForm.hospitalId || !affiliationForm.role) {
      addToast('Select a hospital and enter your role', 'warning'); return;
    }
    setAffiliationSaving(true);
    try {
      await addDoctorAffiliation(user?.id, {
        hospitalId: affiliationForm.hospitalId,
        role: affiliationForm.role,
        isPrimary: affiliationForm.isPrimary,
      });
      addToast('Hospital affiliation added!', 'success');
      setAffiliationForm({ hospitalId: '', role: '', isPrimary: false });
      await loadHospitals();
    } catch (err) {
      addToast(err.message || 'Failed to add affiliation', 'error');
    } finally {
      setAffiliationSaving(false);
    }
  };

  useEffect(() => {
    if (user?.id) loadAvailability(availabilityForm.date);
  }, [user?.id, availabilityForm.date]);

  useEffect(() => {
    if (user?.id && activeTab === 'hospital') loadHospitals();
  }, [user?.id, activeTab]);

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'schedule', label: 'Schedule', icon: CalendarClock },
    { id: 'hospital', label: 'Hospital', icon: Building2 },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Doctor Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Manage your profile, security, availability, and hospital affiliations.
        </p>
      </motion.div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <SectionCard icon={UserCircle} title="Personal Details" subtitle="Update your physician profile information" index={0}>
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <Input label="Full Name" id="name" value={profileForm.name}
                  onChange={(e) => setProfileForm(p => ({ ...p, name: e.target.value }))} required />
                <SpecialtyInput label="Specialties / Areas of Expertise" value={profileForm.specialty}
                  onChange={(val) => setProfileForm(p => ({ ...p, specialty: val }))} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input label="Username" id="username" value={profileForm.username}
                    onChange={(e) => setProfileForm(p => ({ ...p, username: e.target.value }))}
                    required />
                  <Input label="Email Address" id="email" type="email" value={profileForm.email}
                    onChange={(e) => setProfileForm(p => ({ ...p, email: e.target.value }))}
                    required />
                </div>
                <Select label="Gender" id="gender" value={profileForm.gender}
                  onChange={(e) => setProfileForm(p => ({ ...p, gender: e.target.value }))}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </Select>
                <div className="flex justify-end pt-2">
                  <Button type="submit" loading={profileLoading}>
                    <Save className="w-4 h-4" /> Save Changes
                  </Button>
                </div>
              </form>
            </SectionCard>
          </div>

          <div className="space-y-6">
            <SectionCard icon={Stethoscope} title="Credentials" subtitle="Your license information" index={1}>
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">License Number</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">
                    {user?.license_number || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Doctor ID</p>
                  <p className="text-xs font-mono text-gray-600 dark:text-gray-300 mt-1 break-all">
                    {user?.id || user?.doctor_id || 'N/A'}
                  </p>
                </div>
              </div>
            </SectionCard>

            <SectionCard icon={Users} title="Statistics" subtitle="Practice overview" index={2}>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl">
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {user?.daily_patient_limit || user?.dailyPatientLimit || 30}
                  </p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mt-1">Daily Limit</p>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="max-w-lg mx-auto">
          <SectionCard icon={Lock} title="Change Password" subtitle="Update your account password" index={0}>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="relative">
                <Input label="Current Password" id="oldPassword"
                  type={showPassword.old ? 'text' : 'password'}
                  value={passwordForm.oldPassword}
                  onChange={(e) => setPasswordForm(p => ({ ...p, oldPassword: e.target.value }))}
                  placeholder="Enter current password" required />
                <button type="button" onClick={() => setShowPassword(s => ({ ...s, old: !s.old }))}
                  className="absolute right-3 top-9 text-gray-400 hover:text-gray-600">
                  {showPassword.old ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="relative">
                <Input label="New Password" id="newPassword"
                  type={showPassword.new ? 'text' : 'password'}
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm(p => ({ ...p, newPassword: e.target.value }))}
                  placeholder="Min. 6 characters" required />
                <button type="button" onClick={() => setShowPassword(s => ({ ...s, new: !s.new }))}
                  className="absolute right-3 top-9 text-gray-400 hover:text-gray-600">
                  {showPassword.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="relative">
                <Input label="Confirm New Password" id="confirmPassword"
                  type={showPassword.confirm ? 'text' : 'password'}
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm(p => ({ ...p, confirmPassword: e.target.value }))}
                  placeholder="Re-enter new password" required />
                <button type="button" onClick={() => setShowPassword(s => ({ ...s, confirm: !s.confirm }))}
                  className="absolute right-3 top-9 text-gray-400 hover:text-gray-600">
                  {showPassword.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex justify-end pt-2">
                <Button type="submit" loading={passwordLoading}>
                  <Shield className="w-4 h-4" /> Update Password
                </Button>
              </div>
            </form>
          </SectionCard>
        </div>
      )}

      {/* Schedule Tab */}
      {activeTab === 'schedule' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SectionCard icon={Users} title="Default Scheduling" subtitle="Set your practice defaults" index={0}>
            <form onSubmit={handleUpdateLimit} className="space-y-4">
              <Input label="Default daily patient limit" id="dailyPatientLimit" type="number" min="1"
                value={limitForm.dailyPatientLimit}
                onChange={(e) => setLimitForm(l => ({ ...l, dailyPatientLimit: e.target.value }))}
                required />
              <div className="flex justify-end pt-2">
                <Button type="submit" loading={limitLoading}>
                  <Save className="w-4 h-4" /> Update Defaults
                </Button>
              </div>
            </form>
          </SectionCard>

          <SectionCard icon={CalendarClock} title="Daily Availability" subtitle="Set availability for a specific date" index={1}>
            <form onSubmit={handleUpdateAvailability} className="space-y-4">
              <Input label="Date" id="availabilityDate" type="date" value={availabilityForm.date}
                onChange={(e) => setAvailabilityForm(p => ({ ...p, date: e.target.value }))} required />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Start time" id="availabilityStart" type="time" value={availabilityForm.startTime}
                  onChange={(e) => setAvailabilityForm(p => ({ ...p, startTime: e.target.value }))} required />
                <Input label="End time" id="availabilityEnd" type="time" value={availabilityForm.endTime}
                  onChange={(e) => setAvailabilityForm(p => ({ ...p, endTime: e.target.value }))} required />
              </div>
              <Input label="Daily limit (optional)" id="availabilityLimit" type="number" min="1"
                value={availabilityForm.dailyLimit}
                onChange={(e) => setAvailabilityForm(p => ({ ...p, dailyLimit: e.target.value }))}
                placeholder="Leave empty to auto-calculate" />
              <div className="flex justify-end pt-2">
                <Button type="submit" loading={availabilitySaving}>
                  <Clock className="w-4 h-4" /> Save Availability
                </Button>
              </div>
            </form>
          </SectionCard>
        </div>
      )}

      {/* Hospital Tab */}
      {activeTab === 'hospital' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SectionCard icon={Building2} title="Add Affiliation" subtitle="Link a hospital to your profile" index={0}>
            <form onSubmit={handleAddAffiliation} className="space-y-4">
              <Select label="Hospital" id="hospitalId" value={affiliationForm.hospitalId}
                onChange={(e) => setAffiliationForm(f => ({ ...f, hospitalId: e.target.value }))}
                disabled={hospitalsLoading}>
                <option value="">{hospitalsLoading ? 'Loading hospitals...' : 'Select a hospital'}</option>
                {hospitals.map((h) => (
                  <option key={h.hospital_id} value={h.hospital_id}>{h.name}{h.location ? ` — ${h.location}` : ''}</option>
                ))}
              </Select>
              <Input label="Your Role" id="role" value={affiliationForm.role}
                onChange={(e) => setAffiliationForm(f => ({ ...f, role: e.target.value }))}
                placeholder="e.g. Senior Consultant, Attending Physician" required />
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input type="checkbox" checked={affiliationForm.isPrimary}
                  onChange={(e) => setAffiliationForm(f => ({ ...f, isPrimary: e.target.checked }))}
                  className="rounded border-gray-300 text-emerald-500 focus:ring-emerald-500" />
                Set as primary hospital
              </label>
              <div className="flex justify-end pt-2">
                <Button type="submit" loading={affiliationSaving}>
                  <Plus className="w-4 h-4" /> Add Affiliation
                </Button>
              </div>
            </form>
          </SectionCard>

          <SectionCard icon={CheckCircle2} title="Your Affiliations" subtitle="Hospitals you're linked to" index={1}>
            {hospitalsLoading ? (
              <p className="text-sm text-gray-500">Loading affiliations...</p>
            ) : affiliations.length === 0 ? (
              <div className="text-center py-8">
                <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No hospital affiliations yet.</p>
                <p className="text-xs text-gray-400 mt-1">Add your first hospital on the left.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {affiliations.map((aff) => (
                  <div key={aff.affiliation_id || aff.hospital_id}
                    className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                        {aff.hospital_name || aff.name}
                      </p>
                      <p className="text-xs text-gray-500">{aff.role}</p>
                      {aff.location && <p className="text-[10px] text-gray-400">{aff.location}</p>}
                    </div>
                    {aff.is_primary && (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 px-2 py-0.5 rounded-full flex-shrink-0">
                        Primary
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      )}
    </div>
  );
}