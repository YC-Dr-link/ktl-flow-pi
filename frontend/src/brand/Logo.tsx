/**
 * 프로젝트 로고 — "정도(精度) 게이지".
 * 파란 둥근 사각형 안에 계측기 눈금과 빨간 삼각 바늘: 측정이 기준 안에 들어오는지 본다는 뜻.
 * (KTL 기관 로고를 따라 그리지 않는다. 색 계열만 맞춘 우리 과제 로고)
 */
export function LogoMark({ size = 40, spin = false }: { size?: number; spin?: boolean }) {
  return (
    <svg className={`logo-mark${spin ? " spin" : ""}`} width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="정도검사 자동화 로고">
      <defs>
        <linearGradient id="lg-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1A73D1" />
          <stop offset="1" stopColor="#0A4A97" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#lg-bg)" />
      {/* 눈금 호 */}
      <path d="M14 42a18 18 0 0 1 36 0" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="5" strokeLinecap="round" />
      <path d="M14 42a18 18 0 0 1 27.5-15.3" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
      {/* 눈금 */}
      <g stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeOpacity=".8">
        <line x1="32" y1="17" x2="32" y2="20.5" />
        <line x1="19.3" y1="22.3" x2="21.8" y2="24.8" />
        <line x1="44.7" y1="22.3" x2="42.2" y2="24.8" />
      </g>
      {/* 바늘: 빨간 삼각형 */}
      <g className="logo-needle">
        <path d="M28.3 38.9 L47 23.5 L35.7 45.1 Z" fill="#E8262F" />
      </g>
      <circle cx="32" cy="42" r="4.2" fill="#fff" />
      <circle cx="32" cy="42" r="1.8" fill="#0A4A97" />
    </svg>
  );
}

export function Brand({ title, sub = "KTL 정도검사 자동화" }: { title: string; sub?: string }) {
  return (
    <div className="brand">
      <LogoMark size={40} />
      <div className="brand-text">
        <span className="brand-sub">{sub}</span>
        <h1 className="brand-title">{title}</h1>
      </div>
    </div>
  );
}
