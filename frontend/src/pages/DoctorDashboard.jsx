import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Building2, Award, Mail, Key, UserCheck, Plus, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { getDoctorAffiliations, getHospitalsList, addDoctorAffiliation } from '../services/api.js';
import Button from '../components/ui/Button.jsx';
import Input, { Select } from '../components/ui/Input.jsx';

export default function DoctorDashboard() {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [affiliations, setAffiliations] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ hospitalId: '', role: '', isPrimary: false });

  useEffect(() => {
    if (user?.id) {
      Promise.all([
        getDoctorAffiliations(user.id),
        getHospitalsList()
      ])
        .then(([affs, hosps]) => {
          setAffiliations(affs);
          setHospitals(hosps);
        })
        .catch((err) => {
          addToast(err.message || 'Failed to load dashboard data', 'error');
        })
        .finally(() => setLoading(false));
    }
  }, [user?.id]);

  const handleAddAffiliation = async (e) => {
    e.preventDefault();
    if (!form.hospitalId || !form.role.trim()) {
      addToast('Please select a hospital and fill in your role', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const newAff = await addDoctorAffiliation(user.id, {
        hospitalId: form.hospitalId,
        role: form.role,
        isPrimary: form.isPrimary
      });
      addToast('Hospital affiliation added successfully!', 'success');
      
      // Refresh affiliations
      const refreshed = await getDoctorAffiliations(user.id);
      setAffiliations(refreshed);
      
      // Reset form
      setForm({ hospitalId: '', role: '', isPrimary: false });
      setShowAddForm(false);
    } catch (err) {
      addToast(err.message || 'Failed to add affiliation', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <span className="text-4xl animate-spin">⚕️</span>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Loading Doctor Profile...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }} 
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-3xl p-6 text-white shadow-xl shadow-emerald-500/10"
      >
        <h1 className="text-2xl font-bold">Welcome back, Dr. {user?.name || user?.username}</h1>
        <p className="text-emerald-100 text-sm mt-1">
          Thank you for providing care today. Manage your profile, affiliations, and write interactive safe prescriptions.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Doctor Information Card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 space-y-6 shadow-sm"
        >
          <h2 className="text-lg font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-850 pb-3 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-emerald-500" />
            Physician Credentials
          </h2>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Award className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Specialty</p>
                <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                  {Array.isArray(user?.specialty) 
                    ? (user.specialty.length > 0 ? user.specialty.join(', ') : 'General Practitioner') 
                    : (user?.specialty || 'General Practitioner')}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Key className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">License Number</p>
                <p className="text-sm font-bold font-mono text-gray-800 dark:text-gray-200">{user?.license_number || 'N/A'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Email Address</p>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{user?.email}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Building2 className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Username</p>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">@{user?.username}</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Affiliations list */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-850 pb-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-500" />
                Hospital Affiliations
              </h2>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                <Plus className="w-4 h-4" /> Add Hospital
              </button>
            </div>

            {showAddForm && (
              <form onSubmit={handleAddAffiliation} className="bg-gray-50 dark:bg-gray-950 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-4">
                <h3 className="text-sm font-bold text-gray-850 dark:text-gray-200">Add Affiliation</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select
                    label="Hospital Name"
                    id="hospitalSelect"
                    value={form.hospitalId}
                    onChange={(e) => setForm(p => ({ ...p, hospitalId: e.target.value }))}
                    required
                  >
                    <option value="">Select healthcare facility...</option>
                    {hospitals.map(h => (
                      <option key={h.hospital_id} value={h.hospital_id}>{h.name} ({h.location})</option>
                    ))}
                  </Select>

                  <Input
                    label="Role/Designation"
                    id="roleInput"
                    value={form.role}
                    onChange={(e) => setForm(p => ({ ...p, role: e.target.value }))}
                    placeholder="Consultant, Senior Resident, etc."
                    required
                  />
                </div>

                <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <input
                    type="checkbox"
                    checked={form.isPrimary}
                    onChange={(e) => setForm(p => ({ ...p, isPrimary: e.target.checked }))}
                    className="rounded border-gray-300 text-emerald-500"
                  />
                  Mark as my Primary affiliation
                </label>

                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" loading={submitting}>
                    Save Affiliation
                  </Button>
                </div>
              </form>
            )}

            {affiliations.length > 0 ? (
              <div className="divide-y divide-gray-150 dark:divide-gray-800">
                {affiliations.map((aff) => (
                  <div key={aff.id} className="py-4 flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-800 dark:text-gray-200 text-sm">{aff.hospital_name}</h3>
                        {aff.is_primary && (
                          <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                            <Check className="w-3 h-3" /> Primary
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{aff.location} · {aff.type}</p>
                      <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1">Designation: {aff.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                <p className="text-sm">No hospital affiliations on record.</p>
                <p className="text-xs mt-1">Click "Add Hospital" above to add your practice locations.</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
