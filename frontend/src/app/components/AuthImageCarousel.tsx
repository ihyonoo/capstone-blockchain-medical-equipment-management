import { useEffect, useState } from 'react';

// 기본 순서: RTLS → 블록체인 → 자동화 → 배경
const SLIDES = [
  { src: '/images/features/rtls.webp', alt: 'BLE 기반 실시간 위치 추적' },
  { src: '/images/features/blockchain.webp', alt: '블록체인 무결성 검증' },
  { src: '/images/features/auto.webp', alt: 'NFC·RTLS 결합 자동 이력 생성' },
  { src: '/images/hero/monitor.jpg', alt: '의료 장비 모니터' },
];

const AUTO_ADVANCE_MS = 5000;

export default function AuthImageCarousel() {
  const [index, setIndex] = useState(0);

  // index가 바뀔 때마다 타이머를 새로 건다 — 수동으로 넘겨도 자동 전환 간격이 리셋된다.
  useEffect(() => {
    const timer = setTimeout(() => setIndex((prev) => (prev + 1) % SLIDES.length), AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [index]);

  const move = (step: number) => setIndex((prev) => (prev + step + SLIDES.length) % SLIDES.length);

  return (
    <div className="auth-carousel">
      {SLIDES.map((slide, i) => (
        <img
          key={slide.src}
          src={slide.src}
          // 비활성 슬라이드는 alt=""로 두어 보조기술에 중복 노출되지 않게 한다.
          alt={i === index ? slide.alt : ''}
          className={`auth-carousel__image ${i === index ? 'auth-carousel__image--active' : ''}`}
        />
      ))}

      <button
        type="button"
        className="auth-carousel__arrow auth-carousel__arrow--prev"
        aria-label="이전 이미지"
        onClick={() => move(-1)}
      >
        <span className="auth-carousel__chevron auth-carousel__chevron--left" aria-hidden="true" />
      </button>
      <button
        type="button"
        className="auth-carousel__arrow auth-carousel__arrow--next"
        aria-label="다음 이미지"
        onClick={() => move(1)}
      >
        <span className="auth-carousel__chevron auth-carousel__chevron--right" aria-hidden="true" />
      </button>

      <div className="auth-carousel__dots">
        {SLIDES.map((slide, i) => (
          <button
            key={slide.src}
            type="button"
            aria-label={`${i + 1}번째 이미지 보기`}
            aria-current={i === index}
            className={`auth-carousel__dot ${i === index ? 'auth-carousel__dot--active' : ''}`}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
    </div>
  );
}
