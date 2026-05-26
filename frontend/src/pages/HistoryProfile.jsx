import { useEffect, useState } from 'react';
import { Edit2, Plus, Share2, Printer, X } from 'lucide-react';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Badge from '../components/ui/Badge.jsx';
import EmergencyCard from '../components/history/EmergencyCard.jsx';
import { mockUser } from '../data/mockUser.js';
import { getHealthProfile } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';

function calculateBMI(user) {
  if (!user.weight || !user.height) return null;
  const heightInMeters = user.height / 100;
  const bmi = user.weight / (heightInMeters * heightInMeters);
  return bmi;
}

function getBMICategory(bmi) {
  if (bmi == null || Number.isNaN(bmi)) return null;
  if (bmi < 18.5) return { label: 'Underweight', color: 'text-blue-500' };
  if (bmi < 25) return { label: 'Normal', color: 'text-emerald-500' };
  if (bmi < 30) return { label: 'Overweight', color: 'text-amber-500' };
  return { label: 'Obese', color: 'text-red-500' };
}

function calculateAge(dob) {
  if (!dob) return null;
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function formatDateOnly(value) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value).split('T')[0];
  }

  return date.toISOString().slice(0, 10);
}

export default function HistoryProfile() {
  const [user, setUser] = useState(mockUser);
  const [editMode, setEditMode] = useState(false);
  const { addToast } = useToast();
  const conditions = Array.isArray(user.conditions) ? user.conditions : [];
  const allergies = Array.isArray(user.allergies) ? user.allergies : [];
  const surgeries = Array.isArray(user.surgeries) ? user.surgeries : [];
  const vaccinations = Array.isArray(user.vaccinations) ? user.vaccinations : [];
  const bmi = calculateBMI(user);
  const bmiInfo = getBMICategory(bmi);

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      const token = localStorage.getItem('rxsense_token');
      if (!token) {
        return;
      }

      try {
        const profile = await getHealthProfile();
        if (!isMounted || !profile) {
          return;
        }

        setUser({
          ...mockUser,
          ...profile,
          age: calculateAge(profile.dateOfBirth),
          phone: profile.contactInfo || profile.phone || mockUser.phone,
          contactInfo: profile.contactInfo || profile.phone || mockUser.phone,
          conditions: Array.isArray(profile.conditions) ? profile.conditions : mockUser.conditions,
          allergies: Array.isArray(profile.allergies)
            ? profile.allergies.map((allergy) => ({
                id: allergy.id,
                name: allergy.name,
                severity: allergy.severity,
                reaction: allergy.reaction,
              }))
            : mockUser.allergies,
          surgeries: Array.isArray(profile.surgeries) ? profile.surgeries : mockUser.surgeries,
          vaccinations: Array.isArray(profile.vaccinations) ? profile.vaccinations : mockUser.vaccinations,
        });
      } catch (error) {
        console.error('Failed to load patient profile:', error);
      }
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSave = () => {
    setEditMode(false);
    addToast('Profile updated!', 'success');
  };

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Biometrics */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 dark:text-white">Biometric Information</h2>
          <Button variant="ghost" size="sm" onClick={() => setEditMode((p) => !p)}>
            <Edit2 className="w-4 h-4" /> {editMode ? 'Cancel' : 'Edit'}
          </Button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { label: 'Full Name', value: user.name },
            { label: 'Date of Birth', value: formatDateOnly(user.dateOfBirth) },
            { label: 'Age', value: `${user.age} years` },
            { label: 'Gender', value: user.gender },
            { label: 'Blood Group', value: user.bloodGroup },
            { label: 'Phone', value: user.phone },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{label}</p>
              {editMode ? (
                <input defaultValue={value} className="w-full text-sm border-b border-gray-300 dark:border-gray-700 bg-transparent text-gray-900 dark:text-white focus:outline-none focus:border-emerald-500 py-0.5" />
              ) : (
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{value}</p>
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 grid grid-cols-3 gap-4">
          {[
            { label: 'Height', value: `${user.height} cm` },
            { label: 'Weight', value: `${user.weight} kg` },
            { label: 'BMI', value: bmi != null ? bmi.toFixed(1) : '—', extra: bmiInfo },
          ].map(({ label, value, extra }) => (
            <div key={label} className="text-center bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
              {extra && <p className={`text-xs font-medium ${extra.color}`}>{extra.label}</p>}
            </div>
          ))}
        </div>
        {editMode && (
          <div className="mt-3">
            <Button onClick={handleSave} size="sm">Save Changes</Button>
          </div>
        )}
      </Card>

      {/* Conditions */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900 dark:text-white">Known Conditions</h2>
          <Button variant="ghost" size="sm" onClick={() => addToast('Add condition modal — coming soon', 'info')}>
            <Plus className="w-4 h-4" /> Add
          </Button>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Active</p>
          <div className="flex flex-wrap gap-2">
            {conditions.filter((c) => c.status === 'active').map((c) => (
              <div key={c.id} className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-full px-3 py-1">
                <span className="text-xs font-medium text-amber-800 dark:text-amber-300">{c.name} (since {c.since})</span>
                <button className="text-amber-400 hover:text-amber-600"><X className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mt-3">Past / Resolved</p>
          <div className="flex flex-wrap gap-2">
            {conditions.filter((c) => c.status === 'resolved').map((c) => (
              <div key={c.id} className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 rounded-full px-3 py-1">
                <span className="text-xs text-gray-500 dark:text-gray-400 line-through">{c.name} ({c.since})</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Allergies */}
      <Card className="border-red-200 dark:border-red-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-red-700 dark:text-red-400">⚠️ Allergies (Critical)</h2>
          <Button variant="ghost" size="sm" onClick={() => addToast('Add allergy modal — coming soon', 'info')}>
            <Plus className="w-4 h-4" /> Add
          </Button>
        </div>
        <div className="space-y-2">
          {allergies.map((a) => (
            <div key={a.id} className="flex items-center gap-3 p-2.5 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-800">
              <span className="text-red-500 font-bold text-sm">{a.name}</span>
              <Badge variant="red">{a.severity}</Badge>
              <span className="text-xs text-red-600 dark:text-red-400">{a.reaction}</span>
            </div>
          ))}
          <p className="text-xs text-gray-500 dark:text-gray-400">Food allergies: None recorded</p>
        </div>
      </Card>

      {/* Surgical History */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900 dark:text-white">Surgical History</h2>
          <Button variant="ghost" size="sm" onClick={() => addToast('Add surgery modal — coming soon', 'info')}>
            <Plus className="w-4 h-4" /> Add
          </Button>
        </div>
        {surgeries.map((s) => (
          <div key={s.id} className="flex items-center gap-2 text-sm">
            <span className="text-gray-900 dark:text-white font-medium">{s.name}</span>
            <span className="text-gray-500 dark:text-gray-400">— {s.year}, {s.facility}</span>
          </div>
        ))}
      </Card>

      {/* Vaccinations */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900 dark:text-white">Vaccination Record</h2>
          <Button variant="ghost" size="sm" onClick={() => addToast('Add vaccination modal — coming soon', 'info')}>
            <Plus className="w-4 h-4" /> Add
          </Button>
        </div>
        <div className="space-y-2">
          {vaccinations.map((v) => (
            <div key={v.id} className="flex items-center gap-2 text-sm">
              <span className="text-emerald-500">✓</span>
              <span className="text-gray-900 dark:text-white">{v.name}</span>
              <Badge variant="gray">{ "Dose " + v.dose }</Badge>
              <span className="text-xs text-gray-400">{v.date}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Emergency Card */}
      <div>
        <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Emergency Medical Card</h2>
        <EmergencyCard user={user} />
        <div className="flex gap-2 mt-3">
          <Button variant="secondary" onClick={() => addToast('Share link generated!', 'success')}>
            <Share2 className="w-4 h-4" /> Share Emergency Card
          </Button>
          <Button variant="outline" onClick={() => addToast('Printing...', 'info')}>
            <Printer className="w-4 h-4" /> Print
          </Button>
        </div>
      </div>
    </div>
  );
}
