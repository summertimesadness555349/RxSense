import { useEffect, useState } from 'react';
import { CalendarDays, Clock, UserRound, XCircle, MapPin, Check, Hash } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import {
  createAppointment,
  getDoctorsForBooking,
  getPatientAppointments,
  cancelAppointment,
  patientMarkArrived,
} from '../services/api.js';
import Button from '../components/ui/Button.jsx';
import Input, { Select } from '../components/ui/Input.jsx';

const todayInputValue = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
const tomorrowInputValue = () => {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
};



const pad2 = (v) => String(v).padStart(2, '0');

const formatTimeRange = (totalMinutes) => {
  let h = Math.floor((totalMinutes % 1440) / 60);
  const m = (totalMinutes % 1440) % 60;

  // Convert to 12-hour format with AM/PM
  let period = 'AM';
  if (h >= 12) {
    period = 'PM';
  }
  if (h > 12) {
    h = h - 12;
  }
  if (h === 0) {
    h = 12;
  }

  return `${h}:${pad2(m)} ${period}`;
};

const computeProbableTime = (serialNumber, availabilityStartTime) => {
  if (!serialNumber) return null;
  const m = String(availabilityStartTime || '09:00').match(/^(\d{2}):(\d{2})/);
  const base = m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : 9 * 60;
  const offset = (serialNumber - 1) * 10;
  const earliest = base + offset;
  const latest = base + offset + 25;
  return { earliest: formatTimeRange(earliest), latest: formatTimeRange(latest) };
};

export default function Appointments() {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [bookingDate, setBookingDate] = useState(todayInputValue());
  const [listDate, setListDate] = useState(todayInputValue());
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadDoctors = async () => {
    try {
      setLoadingDoctors(true);
      const data = await getDoctorsForBooking();
      setDoctors(data || []);
    } catch (err) {
      addToast(err.message || 'Failed to load doctors', 'error');
    } finally {
      setLoadingDoctors(false);
    }
  };

  const loadAppointments = async (date) => {
    try {
      setLoadingAppointments(true);
      const data = await getPatientAppointments(date);
      setAppointments(data || []);
    } catch (err) {
      addToast(err.message || 'Failed to load appointments', 'error');
    } finally {
      setLoadingAppointments(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      loadDoctors();
      loadAppointments(listDate);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      loadAppointments(listDate);
    }
  }, [listDate, user?.id]);

  // Clamp a date string to [today, tomorrow]
  const clampToAllowedRange = (val) => {
    const today = todayInputValue();
    const tomorrow = tomorrowInputValue();
    if (val < today) return today;
    if (val > tomorrow) return tomorrow;
    return val;
  };

  const handleBook = async (event) => {
    event.preventDefault();

    // Validate date is within allowed range (guards against manual keyboard input)
    const today = todayInputValue();
    const tomorrow = tomorrowInputValue();
    if (bookingDate < today || bookingDate > tomorrow) {
      addToast('You can only book appointments for today or tomorrow', 'warning');
      return;
    }

    if (!selectedDoctorId) {
      addToast('Select a doctor first', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      await createAppointment({
        doctorId: selectedDoctorId,
        appointmentDate: bookingDate,
      });
      addToast('Appointment booked successfully', 'success');
      if (bookingDate === listDate) {
        await loadAppointments(listDate);
      }
    } catch (err) {
      addToast(err.message || 'Failed to book appointment', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const [arrivingId, setArrivingId] = useState(null);

  const handleArrive = async (appointmentId) => {
    setArrivingId(appointmentId);
    try {
      await patientMarkArrived(appointmentId);
      addToast('You have marked yourself as arrived!', 'success');
      await loadAppointments(listDate);
    } catch (err) {
      addToast(err.message || 'Failed to mark arrival', 'error');
    } finally {
      setArrivingId(null);
    }
  };

  const handleCancel = async (appointmentId) => {
    try {
      await cancelAppointment(appointmentId);
      addToast('Appointment cancelled', 'success');
      await loadAppointments(listDate);
    } catch (err) {
      addToast(err.message || 'Failed to cancel appointment', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Appointments</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Book a doctor appointment and track your schedule.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <form
          onSubmit={handleBook}
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 space-y-4"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
            <CalendarDays className="w-4 h-4 text-emerald-500" />
            Book appointment
          </div>

          <Select
            label="Select doctor"
            id="doctorId"
            value={selectedDoctorId}
            onChange={(e) => setSelectedDoctorId(e.target.value)}
            disabled={loadingDoctors}
          >
            <option value="">{loadingDoctors ? 'Loading doctors...' : 'Choose a doctor'}</option>
            {doctors.map((doc) => (
              <option key={doc.doctor_id} value={doc.doctor_id}>
                {doc.name}{' '}
                {doc.specialty?.length
                  ? `(${Array.isArray(doc.specialty) ? doc.specialty.join(', ') : doc.specialty})`
                  : ''}
              </option>
            ))}
          </Select>

          <Input
            label="Appointment date"
            id="appointmentDate"
            type="date"
            value={bookingDate}
            min={todayInputValue()}
            max={tomorrowInputValue()}
            onChange={(e) => setBookingDate(clampToAllowedRange(e.target.value))}
          />



          <Button type="submit" loading={submitting}>
            Book appointment
          </Button>
        </form>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
              <Clock className="w-4 h-4 text-emerald-500" />
              My appointments
            </div>
            <input
              type="date"
              value={listDate}
              onChange={(e) => setListDate(e.target.value)}
              className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-200"
            />
          </div>

          {loadingAppointments ? (
            <p className="text-xs text-gray-500">Loading appointments...</p>
          ) : appointments.length === 0 ? (
            <p className="text-xs text-gray-500">No appointments found for this date.</p>
          ) : (
            <div className="space-y-3">
              {appointments.map((appt) => {
                const status = String(appt.status || 'booked');
                const hasArrived = !!appt.arrival_time;
                return (
                  <div
                    key={appt.appointment_id}
                    className={`rounded-2xl border p-4 ${
                      hasArrived
                        ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-900/10'
                        : 'border-gray-200 dark:border-gray-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                          <UserRound className="w-4 h-4 text-emerald-500" />
                          {appt.doctor_name || 'Doctor'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                          <CalendarDays className="w-3 h-3 text-gray-400" />
                          {(() => {
                            if (!listDate) return '';
                            const [year, month, day] = listDate.split('-');
                            if (!year || !month || !day) return listDate;
                            const date = new Date(Number(year), Number(month) - 1, Number(day));
                            return isNaN(date.getTime()) ? listDate : date.toLocaleDateString();
                          })()}
                        </p>
                        {appt.serial_number && (() => {
                          const time = computeProbableTime(appt.serial_number, appt.availability_start_time);
                          return (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-900/30 px-2 py-0.5 rounded-md">
                                <Hash className="w-3 h-3" />Serial #{appt.serial_number}
                              </span>
                              {time && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-600 bg-gray-100 dark:text-gray-300 dark:bg-gray-800 px-2 py-0.5 rounded-md">
                                  <Clock className="w-3 h-3 text-gray-400" />
                                  Probable Time: {time.earliest} — {time.latest}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {hasArrived && (
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 bg-emerald-100 dark:bg-emerald-800/40 dark:text-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Check className="w-3 h-3" /> Arrived
                          </span>
                        )}
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                          {status}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {(status === 'booked' || status === 'late') && !hasArrived && (
                        <button
                          type="button"
                          onClick={() => handleArrive(appt.appointment_id)}
                          disabled={arrivingId === appt.appointment_id}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-800/30 dark:text-emerald-300 dark:hover:bg-emerald-800/50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          {arrivingId === appt.appointment_id ? 'Marking...' : "I've Arrived"}
                        </button>
                      )}
                      {(status === 'booked' || status === 'late' || status === 'in_progress') && (
                        <button
                          type="button"
                          onClick={() => handleCancel(appt.appointment_id)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}