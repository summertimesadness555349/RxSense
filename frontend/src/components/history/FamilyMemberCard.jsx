import Badge from '../ui/Badge.jsx';

const relationColors = {
  Self: 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700',
  Father: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
  Mother: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
  Brother: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
  Sister: 'bg-pink-50 dark:bg-pink-900/20 border-pink-200 dark:border-pink-800',
};

export default function FamilyMemberCard({ member, onClick, selected }) {
  const color = relationColors[member.relation] || 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800';
  return (
    <div
      onClick={() => onClick?.(member)}
      className={`
        rounded-xl border p-4 cursor-pointer transition-all
        ${color}
        ${selected ? 'ring-2 ring-emerald-500 shadow-md' : 'hover:shadow-md'}
        ${member.relation === 'Self' ? 'col-span-full sm:col-span-1 ring-2 ring-emerald-500' : ''}
      `}
    >
      <div className="text-center">
        <div className="text-2xl mb-1">
          {member.relation === 'Self' ? '🧑' : member.relation === 'Father' ? '👨' : member.relation === 'Mother' ? '👩' : '🧑'}
        </div>
        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{member.relation}</p>
        {member.name && <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">{member.name}</p>}
        {member.age && <p className="text-xs text-gray-400">Age {member.age}</p>}
        <div className="mt-2 flex flex-wrap gap-1 justify-center">
          {member.conditions.length === 0 ? (
            <Badge variant="emerald">No known conditions</Badge>
          ) : (
            member.conditions.slice(0, 2).map((c, i) => (
              <Badge key={i} variant="amber" className="text-[10px]">{c.name}</Badge>
            ))
          )}
          {member.conditions.length > 2 && (
            <Badge variant="gray" className="text-[10px]">+{member.conditions.length - 2} more</Badge>
          )}
        </div>
      </div>
    </div>
  );
}
