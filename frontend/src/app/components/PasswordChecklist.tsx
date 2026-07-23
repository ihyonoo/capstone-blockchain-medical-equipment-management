import { Check, X } from 'lucide-react';
import { PASSWORD_RULES } from '../lib/passwordPolicy';
import { cn } from './ui/utils';

// 비밀번호 정책 충족 여부를 실시간으로 보여주는 흑백 체크리스트.
export default function PasswordChecklist({ value }: { value: string }) {
  if (!value) return null;
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(value);
        return (
          <li
            key={rule.id}
            className={cn('flex items-center gap-1.5', met ? 'text-ok' : 'text-muted-foreground')}
          >
            {met ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
            <span>{rule.label}</span>
          </li>
        );
      })}
    </ul>
  );
}
