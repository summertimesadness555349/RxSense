import { useState } from 'react';
import { Plus } from 'lucide-react';
import FamilyMemberCard from '../components/history/FamilyMemberCard.jsx';
import InsightCard from '../components/ui/InsightCard.jsx';
import RiskBar from '../components/ui/RiskBar.jsx';
import Button from '../components/ui/Button.jsx';
import Modal from '../components/ui/Modal.jsx';
import Card from '../components/ui/Card.jsx';
import Input, { Select, Textarea } from '../components/ui/Input.jsx';
import { mockFamilyMembers, mockHereditaryRisks, mockGeneticRiskScores } from '../data/mockFamilyHistory.js';
import { useToast } from '../context/ToastContext.jsx';

export default function HistoryFamily() {
  const [members, setMembers] = useState(mockFamilyMembers);
  const [selectedMember, setSelectedMember] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const { addToast } = useToast();
  const [form, setForm] = useState({ relation: 'Father', name: '', conditions: '', alive: 'true' });
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleAdd = () => {
    const newMember = {
      id: `fam_${Date.now()}`,
      relation: form.relation,
      name: form.name || 'Unknown',
      alive: form.alive === 'true',
      conditions: form.conditions ? form.conditions.split(',').map((c) => ({ name: c.trim() })) : [],
    };
    setMembers((p) => [...p, newMember]);
    addToast(`${form.relation} added to family history!`, 'success');
    setShowAdd(false);
    setForm({ relation: 'Father', name: '', conditions: '', alive: 'true' });
  };

  const self = members.find((m) => m.relation === 'Self');
  const parents = members.filter((m) => m.relation === 'Father' || m.relation === 'Mother');
  const siblings = members.filter((m) => m.relation === 'Brother' || m.relation === 'Sister');
  const others = members.filter((m) => !['Self', 'Father', 'Mother', 'Brother', 'Sister'].includes(m.relation));

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Family Tree */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 dark:text-white">Family Tree</h2>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4" /> Add Member
          </Button>
        </div>

        <div className="space-y-6">
          {/* Parents */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Parents</p>
            <div className="grid grid-cols-2 gap-3">
              {parents.map((m) => (
                <FamilyMemberCard key={m.id} member={m} onClick={setSelectedMember} selected={selectedMember?.id === m.id} />
              ))}
            </div>
          </div>

          {/* Self */}
          {self && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase mb-2">You</p>
              <div className="max-w-[180px]">
                <FamilyMemberCard member={self} onClick={setSelectedMember} selected={selectedMember?.id === self.id} />
              </div>
            </div>
          )}

          {/* Siblings */}
          {siblings.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Siblings</p>
              <div className="grid grid-cols-2 gap-3">
                {siblings.map((m) => (
                  <FamilyMemberCard key={m.id} member={m} onClick={setSelectedMember} selected={selectedMember?.id === m.id} />
                ))}
              </div>
            </div>
          )}

          {others.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Other</p>
              <div className="grid grid-cols-2 gap-3">
                {others.map((m) => (
                  <FamilyMemberCard key={m.id} member={m} onClick={setSelectedMember} selected={selectedMember?.id === m.id} />
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Member Detail */}
      {selectedMember && (
        <Card>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{selectedMember.name} — {selectedMember.relation}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            Age: {selectedMember.age || 'Unknown'} • {selectedMember.alive !== false ? 'Alive' : 'Deceased'}
          </p>
          {selectedMember.conditions.length === 0 ? (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">✓ No known conditions</p>
          ) : (
            <div className="space-y-1">
              {selectedMember.conditions.map((c, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-amber-500 flex-shrink-0">•</span>
                  <span className="text-gray-800 dark:text-gray-200">{c.name}</span>
                  {c.since && <span className="text-gray-500 dark:text-gray-400 text-xs">(since {c.since})</span>}
                  {c.notes && <span className="text-xs text-gray-400">{c.notes}</span>}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Hereditary Risk Panel */}
      <div>
        <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Hereditary Risk Assessment (AI)</h2>
        <div className="space-y-3">
          {mockHereditaryRisks.map((r, i) => (
            <InsightCard key={i} type={r.type} title={r.title} body={r.message} />
          ))}
        </div>
      </div>

      {/* Genetic Risk Scores */}
      <Card>
        <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Family-Adjusted Risk Score</h2>
        <div className="space-y-4">
          {mockGeneticRiskScores.map((r) => (
            <RiskBar key={r.condition} label={r.condition} percentage={r.percentage} color={r.color} />
          ))}
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
          * Based on family history data you've provided. Not a clinical risk assessment.
        </p>
      </Card>

      {/* Add Family Member Modal */}
      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add Family Member" size="md">
        <div className="space-y-3">
          <Select label="Relationship" value={form.relation} onChange={(e) => set('relation', e.target.value)}>
            {['Father', 'Mother', 'Brother', 'Sister', 'Son', 'Daughter', 'Grandfather', 'Grandmother', 'Uncle', 'Aunt', 'Other'].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
          <Input label="Name (optional)" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g., Abdul Uddin" />
          <Textarea
            label="Known Conditions (comma-separated)"
            value={form.conditions}
            onChange={(e) => set('conditions', e.target.value)}
            placeholder="Hypertension, Diabetes, Heart Disease..."
            rows={2}
          />
          <Select label="Status" value={form.alive} onChange={(e) => set('alive', e.target.value)}>
            <option value="true">Alive</option>
            <option value="false">Deceased</option>
          </Select>
          <div className="flex gap-2 pt-1">
            <Button variant="ghost" onClick={() => setShowAdd(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleAdd} className="flex-1">Add Member</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
