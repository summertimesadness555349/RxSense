import {
  LayoutDashboard, FileText, FlaskConical,
  History, Stethoscope, Pill, MapPin,
  Users, Settings,
} from 'lucide-react';

// labelKey / tooltipKey map to translation keys in translations.js
// The Navbar and Sidebar resolve the text at render time using t()
export const patientNavItems = [
  { to: '/dashboard',    icon: LayoutDashboard, labelKey: 'navDashboard',     tooltipKey: 'navDashboard' },
  { to: '/prescription', icon: FileText,        labelKey: 'navPrescriptions',  tooltipKey: 'navTooltipPrescriptions' },
  { to: '/report',       icon: FlaskConical,    labelKey: 'navReports',        tooltipKey: 'navTooltipReports' },
  { to: '/history',      icon: History,         labelKey: 'navHealthRecord',   tooltipKey: 'navTooltipHealthRecord', highlight: true },
  { to: '/symptoms',     icon: Stethoscope,     labelKey: 'navSymptoms',       tooltipKey: 'navTooltipSymptoms' },
  { to: '/drugs',        icon: Pill,            labelKey: 'navDrugCheck',      tooltipKey: 'navTooltipDrugCheck' },
  { to: '/near-me',      icon: MapPin,          labelKey: 'navNearMe',         tooltipKey: 'navTooltipNearMe' },
];

export const doctorNavItems = [
  { to: '/doctor/dashboard', icon: LayoutDashboard, labelKey: 'navDoctorDashboard', tooltipKey: 'navTooltipDoctorDashboard' },
  { to: '/doctor/patients',  icon: Users,           labelKey: 'navDoctorPatients',  tooltipKey: 'navTooltipDoctorPatients', highlight: true },
  { to: '/settings',         icon: Settings,        labelKey: 'navDoctorSettings',  tooltipKey: 'navTooltipDoctorSettings' },
];
