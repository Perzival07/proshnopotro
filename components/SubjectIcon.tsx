import React from "react";
import {
  BookOpen,
  Atom,
  Calculator,
  FlaskConical,
  Brain,
  Dna,
  Sparkles,
  Compass,
  FileText,
  Lightbulb,
  GraduationCap,
  Microscope,
  Binary,
  LucideProps,
} from "lucide-react";

export const SUBJECT_ICONS: Record<string, React.FC<LucideProps>> = {
  BookOpen,
  Atom,
  Calculator,
  FlaskConical,
  Brain,
  Dna,
  Sparkles,
  Compass,
  FileText,
  Lightbulb,
  GraduationCap,
  Microscope,
  Binary,
};

interface SubjectIconProps extends LucideProps {
  name: string;
}

export function SubjectIcon({ name, ...props }: SubjectIconProps) {
  const IconComponent = SUBJECT_ICONS[name] || BookOpen;
  return <IconComponent {...props} />;
}
