import { useState, useEffect, useCallback } from 'react';
import { Copy, RefreshCw, Plus, Trash2, ChevronDown, ChevronUp, Activity } from 'lucide-react';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Modal from '../components/ui/Modal.jsx';
import Input, { Select } from '../components/ui/Input.jsx';
import { useToast } from '../context/ToastContext.jsx';
import {
  getFamilyShareCode,
  regenerateFamilyShareCode,
  lookupFamilyCode,
  linkFamilyMember,
  getFamilyMembers,
  getFamilyMemberHealth,
  removeFamilyLink,
} from '../services/api.js';

const RELATIONSHIPS = ['Spouse', 'Parent', 'Child', 'Sibling', 'Guardian', 'Other'];

function ShareCodePanel({ code, onRegenerate }) {
  const { addToast } = useToast();

  const copy = () => {
    navigator.clipboard.writeText(code).then(() => addToast('Code copied!', 'success'));
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-900 dark:text-white">My Share Code</h2>
        <button
          onClick={onRegenerate}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          title="Regenerate code"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
        Share this code with family members so they can link to your account and view your health summary.
      </p>
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-2.5 font-mono text-lg font-bold tracking-widest text-gray-900 dark:text-white">
          {code}
        </div>
        <button
          onClick={copy}
          className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
          title="Copy code"
        >
          <Copy className="w-4 h-4" />
        </button>
      </div>
    </Card>
  );
}

function MemberCard({ entry, onRemove, onExpand, expanded }) {
  const { member, relationship, linkId } = entry;
  const bloodBadge = member.bloodGroup
    ? <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300">{member.bloodGroup}</span>
    : null;

  return (
    <Card className="!p-0 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-sm flex-shrink-0">
              {(member.name || '?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white truncate">{member.name || 'RxSense User'}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {relationship}
                {member.age ? ` · ${member.age}y` : ''}
                {member.gender ? ` · ${member.gender}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {bloodBadge}
            <button
              onClick={() => onExpand(linkId)}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              title={expanded ? 'Collapse' : 'View health summary'}
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            <button
              onClick={() => onRemove(linkId, member.name)}
              className="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400"
              title="Remove link"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {member.activeConditions?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {member.activeConditions.map((c, i) => (
              <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                {c}
              </span>
            ))}
          </div>
        )}
      </div>

      {expanded && <MemberHealthPanel linkId={linkId} />}
    </Card>
  );
}

function MemberHealthPanel({ linkId }) {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFamilyMemberHealth(linkId)
      .then(setHealth)
      .catch(() => setHealth(null))
      .finally(() => setLoading(false));
  }, [linkId]);

  if (loading) return (
    <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-3 text-sm text-gray-400">
      Loading health summary...
    </div>
  );

  if (!health) return (
    <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-3 text-sm text-red-400">
      Could not load health summary.
    </div>
  );

  const rows = [
    health.weight       && ['Weight', `${health.weight} kg`],
    (health.bpSystolic && health.bpDiastolic) && ['Blood Pressure', `${health.bpSystolic}/${health.bpDiastolic} mmHg`],
    health.allergyCount > 0 && ['Allergies', `${health.allergyCount} known`],
    health.lastReportAt && ['Last Report', new Date(health.lastReportAt).toLocaleDateString()],
  ].filter(Boolean);

  return (
    <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-3 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
        <Activity className="w-3 h-3" /> Health Summary
      </div>
      {rows.length === 0 && health.conditions?.length === 0 && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">No health data recorded yet.</p>
      )}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
        {rows.map(([label, val]) => (
          <div key={label}>
            <dt className="text-xs text-gray-400 dark:text-gray-500">{label}</dt>
            <dd className="text-sm font-medium text-gray-800 dark:text-gray-200">{val}</dd>
          </div>
        ))}
      </dl>
      {health.conditions?.length > 0 && (
        <div className="pt-1">
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Active Conditions</p>
          <div className="flex flex-wrap gap-1">
            {health.conditions.map((c, i) => (
              <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">{c}</span>
            ))}
          </div>
        </div>
      )}
      {health.allergies?.length > 0 && (
        <div className="pt-1">
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Allergies</p>
          <div className="flex flex-wrap gap-1">
            {health.allergies.map((a, i) => (
              <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300">{a}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AddMemberModal({ isOpen, onClose, onLinked }) {
  const { addToast } = useToast();
  const [step, setStep] = useState('enter'); // 'enter' | 'confirm'
  const [code, setCode] = useState('');
  const [relationship, setRelationship] = useState('Spouse');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reset = () => { setStep('enter'); setCode(''); setPreview(null); setError(''); setRelationship('Spouse'); };
  const close = () => { reset(); onClose(); };

  const handleLookup = async () => {
    if (!code.trim()) return;
    setLoading(true); setError('');
    try {
      const p = await lookupFamilyCode(code.trim());
      setPreview(p);
      setStep('confirm');
    } catch (e) {
      setError(e.message || 'Code not found');
    } finally {
      setLoading(false);
    }
  };

  const handleLink = async () => {
    setLoading(true); setError('');
    try {
      await linkFamilyMember(code.trim(), relationship);
      addToast(`${preview?.name || 'Member'} linked as ${relationship}!`, 'success');
      onLinked();
      close();
    } catch (e) {
      setError(e.message || 'Could not link member');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={close} title="Link a Family Member" size="sm">
      {step === 'enter' ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Ask your family member to open RxSense → Profile → My Share Code, then enter their code below.
          </p>
          <Input
            label="Share Code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="RXF-XXXXXX"
            className="font-mono tracking-widest"
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-2 pt-1">
            <Button variant="ghost" onClick={close} className="flex-1">Cancel</Button>
            <Button onClick={handleLookup} disabled={loading || !code.trim()} className="flex-1">
              {loading ? 'Looking up…' : 'Look Up'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 space-y-1">
            <p className="font-semibold text-gray-900 dark:text-white">{preview?.name || 'RxSense User'}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {[preview?.age && `${preview.age}y`, preview?.gender, preview?.bloodGroup].filter(Boolean).join(' · ')}
            </p>
          </div>
          <Select label="Their relationship to you" value={relationship} onChange={(e) => setRelationship(e.target.value)}>
            {RELATIONSHIPS.map((r) => <option key={r}>{r}</option>)}
          </Select>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-2 pt-1">
            <Button variant="ghost" onClick={() => { setStep('enter'); setError(''); }} className="flex-1">Back</Button>
            <Button onClick={handleLink} disabled={loading} className="flex-1">
              {loading ? 'Linking…' : 'Confirm Link'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function HistoryFamily() {
  const { addToast } = useToast();
  const [shareCode, setShareCode] = useState(null);
  const [members, setMembers] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [codeLoading, setCodeLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(true);

  const loadCode = useCallback(() => {
    setCodeLoading(true);
    getFamilyShareCode()
      .then(setShareCode)
      .catch(() => addToast('Could not load share code', 'error'))
      .finally(() => setCodeLoading(false));
  }, []);

  const loadMembers = useCallback(() => {
    setMembersLoading(true);
    getFamilyMembers()
      .then(setMembers)
      .catch(() => setMembers([]))
      .finally(() => setMembersLoading(false));
  }, []);

  useEffect(() => { loadCode(); loadMembers(); }, [loadCode, loadMembers]);

  const handleRegenerate = async () => {
    try {
      const code = await regenerateFamilyShareCode();
      setShareCode(code);
      addToast('Share code regenerated. Old links made via the previous code remain active.', 'info');
    } catch {
      addToast('Could not regenerate code', 'error');
    }
  };

  const handleRemove = async (linkId, name) => {
    if (!window.confirm(`Remove ${name || 'this member'} from your family network?`)) return;
    try {
      await removeFamilyLink(linkId);
      setMembers((prev) => prev.filter((m) => m.linkId !== linkId));
      addToast('Link removed', 'success');
    } catch {
      addToast('Could not remove link', 'error');
    }
  };

  const handleExpand = (linkId) => setExpandedId((prev) => prev === linkId ? null : linkId);

  return (
    <div className="space-y-5 w-4/5 mx-auto">
      {/* Share Code */}
      {codeLoading ? (
        <Card><div className="h-20 animate-pulse bg-gray-100 dark:bg-gray-800 rounded-lg" /></Card>
      ) : shareCode ? (
        <ShareCodePanel code={shareCode} onRegenerate={handleRegenerate} />
      ) : null}

      {/* Linked Members */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            Family Network
            {members.length > 0 && (
              <span className="ml-2 text-xs font-normal text-gray-400">({members.length})</span>
            )}
          </h2>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4" /> Add Member
          </Button>
        </div>

        {membersLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <div key={i} className="h-16 animate-pulse bg-gray-100 dark:bg-gray-800 rounded-lg" />)}
          </div>
        ) : members.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-gray-400 dark:text-gray-500 text-sm">No family members linked yet.</p>
            <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
              Share your code above, or click Add Member to enter someone else's code.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {members.map((entry) => (
              <MemberCard
                key={entry.linkId}
                entry={entry}
                onRemove={handleRemove}
                onExpand={handleExpand}
                expanded={expandedId === entry.linkId}
              />
            ))}
          </div>
        )}
      </Card>

      <AddMemberModal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        onLinked={loadMembers}
      />
    </div>
  );
}
