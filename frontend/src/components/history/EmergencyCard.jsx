import { Heart, Phone, AlertTriangle, Pill } from 'lucide-react';

export default function EmergencyCard({ user, compact = false }) {
  if (compact) {
    return (
      <div className="bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Heart className="w-4 h-4" />
          <span className="font-bold text-sm">Emergency Medical Info</span>
        </div>
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div>
            <p className="opacity-70">Blood Group</p>
            <p className="font-bold text-lg">{user?.bloodGroup || 'B+'}</p>
          </div>
          <div>
            <p className="opacity-70">Allergies</p>
            <p className="font-semibold">{user?.allergies?.[0]?.name || 'None'}</p>
          </div>
          <div>
            <p className="opacity-70">Emergency</p>
            <p className="font-semibold">{user?.emergencyContact?.name || 'N/A'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-red-600 to-red-800 text-white rounded-2xl p-5 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Heart className="w-5 h-5" />
          <span className="font-bold">Emergency Medical Card</span>
        </div>
        <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">RxSense</span>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-red-200 text-xs font-medium uppercase">Patient</p>
          <p className="font-bold text-lg">{user?.name}</p>
          <p className="text-red-200 text-sm">
            {user?.age} years • {user?.gender} • Blood Group: <span className="text-white font-bold text-lg">{user?.bloodGroup}</span>
          </p>
        </div>

        {user?.allergies?.length > 0 && (
          <div className="bg-white/20 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle className="w-4 h-4" />
              <span className="font-bold text-sm">ALLERGIES</span>
            </div>
            {user.allergies.map((a) => (
              <p key={a.id} className="text-sm">
                <span className="font-bold">{a.name}</span>
                <span className="text-red-200"> — {a.severity} • {a.reaction}</span>
              </p>
            ))}
          </div>
        )}

        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Pill className="w-4 h-4" />
            <span className="text-xs font-medium text-red-200 uppercase">Current Medications</span>
          </div>
          <p className="text-sm">Metformin 500mg, Iron Supplement 200mg</p>
        </div>

        <div className="border-t border-white/20 pt-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Phone className="w-4 h-4" />
            <span className="text-xs font-medium text-red-200 uppercase">Emergency Contact</span>
          </div>
          <p className="font-semibold">{user?.emergencyContact?.name}</p>
          <p className="text-sm text-red-200">{user?.emergencyContact?.phone} • {user?.emergencyContact?.relation}</p>
        </div>
      </div>
    </div>
  );
}
