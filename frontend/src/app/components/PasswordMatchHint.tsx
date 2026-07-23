import { Check, X } from 'lucide-react';
import { cn } from './ui/utils';

// 비밀번호 확인 입력의 일치 여부를 실시간으로 안내한다.
// 확인값이 비어 있으면 아무것도 표시하지 않는다.
export default function PasswordMatchHint({
  password,
  confirm,
}: {
  password: string;
  confirm: string;
}) {
  if (!confirm) return null;
  const matched = password === confirm;
  return (
    <p className={cn('flex items-center gap-1.5 text-sm', matched ? 'text-ok' : 'text-err')}>
      {matched ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
      <span>{matched ? '비밀번호가 일치합니다' : '비밀번호가 일치하지 않습니다'}</span>
    </p>
  );
}
