import type { SendTab } from './types';

const TABS: { value: SendTab; label: string }[] = [
  { value: 'text', label: '텍스트' },
  { value: 'env', label: '.env' },
  { value: 'file', label: '파일' },
];

export default function TabBar(props: { value: SendTab; onChange: (v: SendTab) => void }) {
  return (
    <div role="tablist">
      {TABS.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={props.value === t.value}
          onClick={() => props.onChange(t.value)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
