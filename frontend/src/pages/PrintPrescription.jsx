import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getDoctorPatientChart } from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { Printer, ArrowLeft } from "lucide-react";
import Button from "../components/ui/Button.jsx";

// ─── Helpers ────────────────────────────────────────────────────────────────

const calculateAge = (dobString) => {
  if (!dobString) return "N/A";
  try {
    const dob = new Date(dobString);
    const diff = Date.now() - dob.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25)) + " yrs";
  } catch {
    return "N/A";
  }
};

const fmtDate = (value) => {
  if (!value) return "N/A";
  try {
    return new Date(value).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "N/A";
  }
};

// ─── Presentation Atoms ────────────────────────────────────────────────

function InfoCell({ label, value }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 min-w-[75px]">
        {label}:
      </span>
      <span className="text-sm font-semibold text-gray-800 break-all">
        {value || "N/A"}
      </span>
    </div>
  );
}

function SectionHeading({ children }) {
  return (
    <h3 className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 mb-1.5 border-b border-emerald-100 pb-0.5">
      {children}
    </h3>
  );
}

function Block({ label, text }) {
  if (!text) return null;
  return (
    <div className="mb-4 break-inside-avoid">
      <SectionHeading>{label}</SectionHeading>
      <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed pl-0.5">
        {text}
      </p>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

const PrintPrescription = () => {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const result = await getDoctorPatientChart(patientId);
        setData(result);
      } catch (err) {
        addToast(err.message || "Failed to load prescription data", "error");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [patientId, addToast]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-xs tracking-wide">Preparing prescription…</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center p-12 text-center">
        <p className="text-gray-400 text-sm">Prescription data not found.</p>
      </div>
    );
  }

  const patient = data.patient || {};
  const chart   = data.chart   || {};

  const latestRx = chart.activePrescriptions?.[0] || null;

  const allActiveItems = (chart.activePrescriptions || []).flatMap((rx) =>
    (rx.items || []).map((item) => ({
      ...item,
      prescription_id: rx.prescription_id,
      issued_at: rx.issued_at,
    }))
  );

  const newRxItems = (latestRx?.items || []).filter(
    (item) => String(item.status || "active").toLowerCase() !== "stopped"
  );

  const continuingItems = allActiveItems.filter(
    (item) =>
      String(item.status || "active").toLowerCase() === "active" &&
      item.prescription_id !== latestRx?.prescription_id
  );

  const vitals = [
    patient.bloodPressureSystolic && patient.bloodPressureDiastolic
      ? `BP: ${patient.bloodPressureSystolic}/${patient.bloodPressureDiastolic} mmHg`
      : null,
    patient.height ? `Ht: ${patient.height} cm` : null,
    patient.weight ? `Wt: ${patient.weight} kg` : null,
    patient.bloodGroup ? `Blood: ${patient.bloodGroup}` : null,
  ].filter(Boolean).join("  •  ");

  const cleanDiagnosis =
    latestRx?.diagnosis
      ? latestRx.diagnosis
          .split(",")
          .map((d) => d.split(" - Severity:")[0].split(" - Status:")[0].trim())
          .join(", ")
      : (chart.conditions || [])
          .map((c) => c.condition_name)
          .filter(Boolean)
          .join(", ") || undefined;

  const cleanInvestigations =
    latestRx?.investigations ||
    (chart.reports || [])
      .slice(0, 4)
      .map((r) => r.report_type?.split(" - ")[0].trim())
      .filter(Boolean)
      .join("\n") ||
    undefined;

  const doctorName    = user?.name || user?.username || "Doctor";
  const specialty     = Array.isArray(user?.specialty)
    ? user.specialty.join(", ") || "General Practitioner"
    : user?.specialty || "General Practitioner";
  const licenseNumber = user?.license_number || "N/A";

  return (
    <>
      {/* ── Screen Toolbar ─────────────────────────────────────────── */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-2.5 flex items-center justify-between shadow-xs">
        <Button variant="ghost" onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          Prescription Preview
        </span>
        <Button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs px-4 py-1.5 rounded-md transition-colors"
        >
          <Printer className="w-4 h-4" /> Print Document
        </Button>
      </div>

      {/* ── Printable Area ──────────────────────────────────────────────── */}
      <div className="min-h-screen bg-gray-50 py-8 px-4 print:p-0 print:bg-white flex justify-center">
        <div
          id="rx-print-area"
          className="w-full max-w-2xl bg-white shadow-xs p-8 md:p-12 print:p-0 print:shadow-none print:max-w-full font-serif"
          style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
        >

          {/* ── Header ──────────────────────────────────────────────────── */}
          <header className="flex justify-between items-start border-b border-gray-300 pb-4 mb-6">
            <div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">
                Dr. {doctorName}
              </h1>
              <p className="text-xs font-sans text-gray-600 mt-0.5">{specialty}</p>
              <p className="text-[11px] font-sans text-gray-400 mt-0.5">
                Reg. No: {licenseNumber}
              </p>
            </div>

            <div className="text-right font-sans">
              <div className="text-xs font-bold text-emerald-800 tracking-wider uppercase mb-1">
                RxSense Clinical
              </div>
              <p className="text-[11px] text-gray-500">
                Date: {latestRx?.issued_at ? fmtDate(latestRx.issued_at) : fmtDate(new Date().toISOString())}
              </p>
            </div>
          </header>

          {/* ── Patient Demographics ─────────────────────────────────────── */}
          <section className="font-sans grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 border-b border-gray-200 pb-4 mb-5">
            <InfoCell label="Patient" value={patient.name} />
            <InfoCell label="ID" value={patient.patient_id} />
            <InfoCell label="Age / Sex" value={`${calculateAge(patient.date_of_birth)} / ${patient.gender || "N/A"}`} />
            <InfoCell label="Phone" value={patient.phone} />
          </section>

          {vitals && (
            <p className="text-[11px] font-mono text-gray-500 mb-6 tracking-wide">{vitals}</p>
          )}

          {/* ── Standard Pad Layout split ─────────────────────────────── */}
          <div className="flex flex-col md:flex-row gap-8 items-start min-h-[450px] print:flex-row print:gap-8">
            
            {/* Left Column: Case Notes / Vitals */}
            <div className="w-full md:w-1/3 print:w-1/3 flex-shrink-0 font-sans border-r border-gray-100 pr-4 hidden md:block print:block">
              {(latestRx?.chiefComplaint || latestRx?.notes) && (
                <Block
                  label="Chief Complaint"
                  text={latestRx?.chiefComplaint || latestRx?.notes}
                />
              )}
              <Block label="On Examination" text={latestRx?.examination} />
              <Block label="Diagnosis" text={cleanDiagnosis} />
              <Block label="Investigation" text={cleanInvestigations} />
              <Block label="Referred By" text={latestRx?.referredBy} />
            </div>

            {/* Mobile Fallback for Case Notes (Saves spacing on small screens) */}
            <div className="w-full block md:hidden print:hidden font-sans space-y-4">
              {(latestRx?.chiefComplaint || latestRx?.notes) && (
                <Block label="Chief Complaint" text={latestRx?.chiefComplaint || latestRx?.notes} />
              )}
              <Block label="Diagnosis" text={cleanDiagnosis} />
            </div>

            {/* Right Column: Prescription Proper */}
            <div className="flex-1 w-full">
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-3xl font-bold font-serif text-gray-900 select-none">Rx</span>
                <span className="text-[9px] font-bold font-sans tracking-widest text-gray-400 uppercase">
                  Medications
                </span>
              </div>

              {newRxItems.length > 0 ? (
                <div className="space-y-4">
                  {newRxItems.map((item, idx) => (
                    <div key={item.item_id || idx} className="break-inside-avoid">
                      <div className="flex items-start gap-1.5">
                        <span className="text-xs font-bold text-gray-400 w-4 pt-0.5">{idx + 1}.</span>
                        <div>
                          <p className="text-sm font-bold text-gray-900 leading-tight">
                            {item.brand_name || item.generic_name}
                            {item.brand_name && item.generic_name && (
                              <span className="font-normal font-sans text-gray-500 text-xs ml-1.5">
                                ({item.generic_name})
                              </span>
                            )}
                          </p>
                          <p className="text-xs font-sans text-gray-600 mt-0.5">
                            {[item.dosage, item.frequency, item.duration_days ? `${item.duration_days} days` : null]
                              .filter(Boolean)
                              .join("  ·  ")}
                          </p>
                          {item.instructions && (
                            <p className="text-[11px] font-sans text-gray-400 italic mt-0.5 pl-1 border-l border-gray-200">
                              {item.instructions}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs font-sans text-gray-400 italic">No new medications prescribed.</p>
              )}
            </div>
          </div>

          {/* ── Advice & Follow up Plan ─────────────────────────────────── */}
          {(latestRx?.advice || latestRx?.followUp) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-t border-gray-200 pt-5 mt-6 font-sans break-inside-avoid">
              {latestRx?.advice && (
                <div>
                  <SectionHeading>Advice & Instructions</SectionHeading>
                  <p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">
                    {latestRx.advice}
                  </p>
                </div>
              )}
              {latestRx?.followUp && (
                <div>
                  <SectionHeading>Follow-up Plan</SectionHeading>
                  <p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">
                    {latestRx.followUp}
                  </p>
                </div>
              )}
            </div>
          )}
          {/* ── Continuing Medications ───────────────────────────────────── */}
{continuingItems.length > 0 && (
  <section className="mt-6 border-t border-gray-200 pt-5 font-sans break-inside-avoid">
    <SectionHeading>Continuing Medications</SectionHeading>
    <div className="space-y-2">
      {continuingItems.map((item, idx) => (
        <div key={item.item_id || idx} className="py-1 border-b border-gray-50 last:border-0">
          <div className="flex justify-between items-baseline text-xs">
            <span className="font-medium text-gray-700">
              • {item.brand_name || item.generic_name}
            </span>
            <span className="text-gray-400 text-[11px] font-normal">
              {[item.dosage, item.frequency].filter(Boolean).join(" · ")}
            </span>
          </div>
          {item.instructions && (
            <p className="text-[11px] text-gray-400 italic mt-0.5 pl-3">
              {item.instructions}
            </p>
          )}
        </div>
      ))}
    </div>
  </section>
)}

          {/* ── Footer ───────────────────────────────────────────────────── */}
          <footer className="mt-16 pt-4 border-t border-gray-200 flex justify-between items-end font-sans break-inside-avoid">
            <div className="text-[10px] text-gray-400 leading-normal max-w-xs">
              <p>This is a digital prescription valid only under medical oversight.</p>
              <p className="mt-0.5">Powered by RxSense Digital Health Ecosystem.</p>
            </div>
            <div className="text-center">
              <div className="w-40 border-t border-gray-400 pt-1.5">
                <p className="text-xs font-bold text-gray-800">Dr. {doctorName}</p>
                <p className="text-[10px] text-gray-400 tracking-wide mt-0.5">Signature / Stamp</p>
              </div>
            </div>
          </footer>

        </div>
      </div>

      {/* ── Native Print Formatting ─────────────────────────────────────── */}
      <style>{`
        @media print {
          @page { 
            size: A4;
            margin: 15mm 20mm 15mm 20mm; 
          }
          body { 
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact;
            background-color: #fff !important;
          }
          .break-inside-avoid {
            break-inside: avoid;
          }
        }
      `}</style>
    </>
  );
};

export default PrintPrescription;