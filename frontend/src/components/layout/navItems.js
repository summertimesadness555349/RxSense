import {
  LayoutDashboard, FileText, FlaskConical,
  History, Stethoscope, Pill, MapPin,
} from 'lucide-react';

// labelKey / tooltipKey map to translation keys in translations.js
// The Navbar and Sidebar resolve the text at render time using t()
export const navItems = [
  { to: '/dashboard',    icon: LayoutDashboard, labelKey: 'navDashboard',     tooltipKey: 'navDashboard' },
  { to: '/prescription', icon: FileText,        labelKey: 'navPrescriptions',  tooltipKey: 'navTooltipPrescriptions' },
  { to: '/report',       icon: FlaskConical,    labelKey: 'navReports',        tooltipKey: 'navTooltipReports' },
  { to: '/history',      icon: History,         labelKey: 'navHealthRecord',   tooltipKey: 'navTooltipHealthRecord', highlight: true },
  { to: '/symptoms',     icon: Stethoscope,     labelKey: 'navSymptoms',       tooltipKey: 'navTooltipSymptoms' },
  { to: '/drugs',        icon: Pill,            labelKey: 'navDrugCheck',      tooltipKey: 'navTooltipDrugCheck' },
  { to: '/near-me',      icon: MapPin,          labelKey: 'navNearMe',         tooltipKey: 'navTooltipNearMe' },
];
