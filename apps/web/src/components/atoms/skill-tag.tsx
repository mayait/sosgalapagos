type SkillValue =
  | 'driving'
  | 'medical'
  | 'logistics'
  | 'cooking'
  | 'languages'
  | 'admin'
  | 'general'
  | 'ngo'
  | 'government';

const SKILL_LABELS: Record<SkillValue, string> = {
  driving: 'Camioneta',
  medical: 'Sanitario / médico',
  logistics: 'Logística',
  cooking: 'Cocina',
  languages: 'Idiomas',
  admin: 'Administración',
  general: 'Apoyo general',
  ngo: 'ONG',
  government: 'Organismo estatal',
};

interface SkillTagProps {
  skill: string;
}

export function SkillTag({ skill }: SkillTagProps) {
  const label = SKILL_LABELS[skill as SkillValue] ?? skill;
  return (
    <span className="inline-flex items-center rounded-full border border-info-line bg-info-soft px-2.5 py-0.5 text-xs font-semibold text-info">
      {label}
    </span>
  );
}
