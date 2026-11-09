export default function IconeMartelo({ tamanho = 24 }) {
  return (
    <svg viewBox="0 0 64 64" width={tamanho} height={tamanho} fill="none" stroke="currentColor"
      strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="25" y="15" width="26" height="14" rx="3" transform="rotate(45 38 22)" />
      <line x1="34" y1="26" x2="10" y2="50" />
      <line x1="8" y1="58" x2="34" y2="58" />
    </svg>
  );
}
