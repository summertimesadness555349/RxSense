import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { LanguageProvider } from './context/LanguageContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import MainLayout from './components/layout/MainLayout.jsx';
import AuthLayout from './components/layout/AuthLayout.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Prescription from './pages/Prescription.jsx';
import Report from './pages/Report.jsx';
import History from './pages/History.jsx';
import HistoryTimeline from './pages/HistoryTimeline.jsx';
import HistoryProfile from './pages/HistoryProfile.jsx';
import HistoryDocuments from './pages/HistoryDocuments.jsx';
import HistoryMedications from './pages/HistoryMedications.jsx';
import HistoryInsights from './pages/HistoryInsights.jsx';
import HistoryFamily from './pages/HistoryFamily.jsx';
import Symptoms from './pages/Symptoms.jsx';
import Drugs from './pages/Drugs.jsx';
import NearMe from './pages/NearMe.jsx';
import Appointments from './pages/Appointments.jsx';
import Settings from './pages/Settings.jsx';
import DoctorDashboard from './pages/DoctorDashboard.jsx';
import DoctorPatients from './pages/DoctorPatients.jsx';
import DoctorSettings from './pages/DoctorSettings.jsx';
import NotFound from './pages/NotFound.jsx';
import Docs from './pages/Docs.jsx';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <LanguageProvider>
          <ToastProvider>
            <BrowserRouter>
              <Routes>
                {/* Public */}
                <Route path="/" element={<Landing />} />
                <Route path="/docs" element={<Docs />} />

                {/* Auth */}
                <Route element={<AuthLayout />}>
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                </Route>

                {/* Protected */}
                <Route element={<MainLayout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/doctor/dashboard" element={<DoctorDashboard />} />
                  <Route path="/doctor/patients" element={<DoctorPatients />} />
                  <Route path="/doctor/settings" element={<DoctorSettings />} />
                  <Route path="/prescription" element={<Prescription />} />
                  <Route path="/report" element={<Report />} />
                  <Route path="/history" element={<History />}>
                    <Route index element={<HistoryTimeline />} />
                    <Route path="profile" element={<HistoryProfile />} />
                    <Route path="documents" element={<HistoryDocuments />} />
                    <Route path="medications" element={<HistoryMedications />} />
                    <Route path="insights" element={<HistoryInsights />} />
                    <Route path="family" element={<HistoryFamily />} />
                  </Route>
                  <Route path="/symptoms" element={<Symptoms />} />
                  <Route path="/drugs" element={<Drugs />} />
                  <Route path="/near-me" element={<NearMe />} />
                  <Route path="/appointments" element={<Appointments />} />
                  <Route path="/settings" element={<Settings />} />
                </Route>

                {/* Catch-all */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </ToastProvider>
        </LanguageProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
