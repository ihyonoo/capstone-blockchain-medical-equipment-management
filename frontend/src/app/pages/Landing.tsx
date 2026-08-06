import { Link } from 'react-router';
import { motion } from 'motion/react';
import { IconContext, ShieldCheck, WifiHigh, MapPin, Scan, LinkSimple, ArrowRight } from '@phosphor-icons/react';
import '../../styles/landing.css';

const PROBLEMS = [
  {
    title: '장비가 어디 있는지 몰라 찾는 데만 시간을 씁니다',
    copy: '수십 대의 장비가 여러 병동을 오가면, 필요한 순간에 위치를 파악하는 데만 상당한 시간이 소요됩니다.',
  },
  {
    title: '사용 이력이 조작되지 않았다고 증명하기 어렵습니다',
    copy: '수기 또는 일반 DB 기록만으로는 사후에 이력이 바뀌지 않았음을 객관적으로 증명하기 어렵습니다.',
  },
  {
    title: '사용 이력을 수기로 기록하다 보니 누락과 오류가 반복됩니다',
    copy: '사용 이력을 사람이 직접 기록하면 오류, 누락 문제가 반복적으로 발생하며 허위 기재의 위험이 존재합니다.',
  },
];

const FEATURES = [
  {
    image: '/images/features/blockchain.webp',
    title: '블록체인 무결성 검증',
    copy: '완료된 사용 이력은 프라이빗 Hyperledger Besu 체인에 앵커링되어, 이후 언제든 위변조 여부를 검증할 수 있습니다.',
    bullets: [
      '사용 이력을 블록체인에 기록',
      '기록뿐만 아니라 머클 증명을 활용한 완벽한 검증',
      '사후 대조로 조작 여부 즉시 확인',
      '감사·규정 대응 자료로 활용',
    ],
  },
  {
    image: null,
    title: 'NFC·RTLS 결합 자동 이력 생성',
    copy: '블록체인에 기록해도 입력값 자체가 틀리면 소용없습니다. NFC·RTLS 데이터를 결합해 사용 이력을 자동으로 생성함으로써 사람의 실수와 허위 입력을 원천 차단하고, 이력의 신뢰성을 한층 끌어올립니다.',
    bullets: [
      'NFC 체크아웃·반납과 RTLS 위치 데이터를 결합해 이력 자동 생성',
      '휴먼에러·허위 입력을 원천 차단',
      '정확한 원본 데이터로 블록체인 기록의 신뢰성 강화',
      '수기 기록 업무 부담 감소로 운영 효율 향상',
    ],
  },
  {
    image: '/images/features/rtls.webp',
    title: '실시간 위치 추적 (BLE 기반 RTLS)',
    copy: '의료진이 장비를 찾아 헤매는 시간을 없애 진료에만 집중하게 하고, 탐색에 낭비되던 인건비와 장비 유휴 비용을 절감합니다.',
    bullets: [
      '장비에 부착된 비콘을 구역별 RTLS 리더기가 감지',
      '신호 세기(RSSI) 기반 위치 판정',
      '의료진 대시보드에서 즉시 확인',
      '저전력 블루투스(BLE) 기반으로 저렴한 설치·유지보수 비용',
    ],
  },
];

const STEPS = [
  { icon: WifiHigh, title: 'RTLS 리더 신호 수신', copy: '구역에 설치된 리더가 태그의 BLE 신호를 수집합니다.' },
  { icon: MapPin, title: '위치 판정', copy: '신호 세기를 분석해 장비의 현재 위치를 판정합니다.' },
  { icon: Scan, title: 'NFC 체크아웃/반납', copy: '직원이 NFC로 태그해 대여·반납을 기록합니다.' },
  { icon: LinkSimple, title: '블록체인 앵커링', copy: '반납이 완료되면 사용 이력이 블록체인에 앵커링됩니다.' },
];

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.5, ease: 'easeOut' },
};

export default function Landing() {
  return (
    <IconContext.Provider value={{ weight: 'duotone' }}>
      <div className="landing">
        <header className="landing__nav">
          <div className="landing__container landing__nav-inner">
            <span className="landing__brand">MediLedger EquipTrace</span>
            <nav className="landing__nav-links">
              <a className="landing__nav-link" href="#features">
                기능
              </a>
              <a className="landing__nav-link" href="#how-it-works">
                작동 방식
              </a>
            </nav>
            <div className="landing__nav-actions">
              <Link to="/login" className="landing__btn landing__btn--outline landing__btn--sm">
                로그인
              </Link>
              <Link to="/signup" className="landing__btn landing__btn--solid landing__btn--sm">
                회원가입
              </Link>
            </div>
          </div>
        </header>

        <main>
          <section className="landing__hero">
            <div className="landing__container landing__hero-inner">
              <div>
                <span className="landing__eyebrow">의료 장비 추적 · 블록체인 기반 무결성 검증</span>
                <h1 className="landing__headline">
                  장비의 위치부터 사용 이력까지,
                  <br />
                  <em>위변조 없이</em> 증명합니다
                </h1>
                <p className="landing__subcopy">
                  MediLedger EquipTrace는 BLE 기반 실시간 위치 추적과 프라이빗 블록체인 앵커링으로 의료 장비의 대여·반납
                  이력을 자동으로 기록하고 사후 검증까지 지원합니다.
                </p>
                <div className="landing__hero-actions">
                  <Link to="/signup" className="landing__btn landing__btn--accent">
                    회원가입 <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link to="/login" className="landing__btn landing__btn--outline">
                    로그인
                  </Link>
                </div>
                <div className="landing__badges">
                  <span className="landing__badge">Hyperledger Besu 기반 프라이빗 블록체인</span>
                  <span className="landing__badge">BLE iBeacon 실시간 위치 추적</span>
                  <span className="landing__badge">NFC 기반 장비 식별 및 장비 대여/반납</span>
                </div>
              </div>

              <div className="landing__mock-card" aria-hidden="true">
                <div className="landing__mock-header">
                  <span className="landing__mock-title">장비 상태 요약</span>
                  <span className="landing__mock-verified">
                    <ShieldCheck className="h-3.5 w-3.5" /> 무결성 검증됨
                  </span>
                </div>
                <div className="landing__mock-row">
                  <span className="landing__mock-label">인퓨전 펌프 #A102</span>
                  <span className="landing__mock-value">
                    <span className="landing__mock-dot" />
                    3병동 · 사용 중
                  </span>
                </div>
                <div className="landing__mock-row">
                  <span className="landing__mock-label">초음파 진단기 #B07</span>
                  <span className="landing__mock-value">
                    <span className="landing__mock-dot" />
                    영상의학과 · 대기
                  </span>
                </div>
                <div className="landing__mock-row">
                  <span className="landing__mock-label">제세동기 #C21</span>
                  <span className="landing__mock-value">
                    <span className="landing__mock-dot" />
                    응급실 · 사용 중
                  </span>
                </div>
              </div>
            </div>
          </section>

          <motion.section className="landing__section" {...fadeUp}>
            <div className="landing__container">
              <div className="landing__section-head">
                <p className="landing__section-eyebrow">왜 필요한가</p>
                <h2 className="landing__section-title">이런 어려움, 익숙하지 않으신가요?</h2>
              </div>
              <div className="landing__problem-grid">
                {PROBLEMS.map((item, index) => (
                  <div className="landing__problem-card" key={item.title}>
                    <span className="landing__problem-index">{index + 1}</span>
                    <h3 className="landing__problem-title">{item.title}</h3>
                    <p className="landing__problem-copy">{item.copy}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.section>

          <motion.section className="landing__section landing__section--alt" id="features" {...fadeUp}>
            <div className="landing__container">
              <div className="landing__section-head">
                <p className="landing__section-eyebrow">핵심 기능</p>
                <h2 className="landing__section-title">
                  위변조 없이 증명하고, 정확하게 기록하며, 실시간으로 확인합니다
                </h2>
              </div>
              <div className="landing__features-stack">
                {FEATURES.map((feature) => (
                  <div className="landing__feature-row" key={feature.title}>
                    <div className="landing__feature-media">
                      {feature.image ? (
                        <img src={feature.image} alt={feature.title} />
                      ) : (
                        <div className="landing__feature-media-placeholder" />
                      )}
                    </div>
                    <div className="landing__feature-body">
                      <h3 className="landing__feature-title">{feature.title}</h3>
                      <p className="landing__feature-copy">{feature.copy}</p>
                      <ul className="landing__feature-bullets">
                        {feature.bullets.map((bullet) => (
                          <li key={bullet}>{bullet}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.section>

          <motion.section className="landing__section" id="how-it-works" {...fadeUp}>
            <div className="landing__container">
              <div className="landing__section-head">
                <p className="landing__section-eyebrow">작동 방식</p>
                <h2 className="landing__section-title">신호 수신부터 블록체인 앵커링까지</h2>
              </div>
              <div className="landing__steps">
                {STEPS.map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <div className="landing__step" key={step.title}>
                      <span className="landing__step-index">{index + 1}</span>
                      <h3 className="landing__step-title">
                        <Icon className="h-4 w-4" style={{ display: 'inline', marginRight: '0.35rem' }} />
                        {step.title}
                      </h3>
                      <p className="landing__step-copy">{step.copy}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.section>

          <section className="landing__cta-band">
            <div className="landing__container landing__cta-inner">
              <h2 className="landing__cta-title">지금 시작해보세요</h2>
              <p className="landing__cta-copy">회원가입하고 장비 관리를 더 투명하고 정확하게 만들어보세요.</p>
              <Link to="/signup" className="landing__btn landing__btn--inverse">
                지금 시작하기 <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>
        </main>

        <footer className="landing__footer">
          <div className="landing__container landing__footer-inner">
            <div>
              <div className="landing__footer-brand">MediLedger EquipTrace</div>
              <div className="landing__footer-copyright">© 2026 MediLedger EquipTrace</div>
            </div>
            <div className="landing__footer-links">
              <Link to="/login">로그인</Link>
              <Link to="/signup">회원가입</Link>
            </div>
          </div>
        </footer>
      </div>
    </IconContext.Provider>
  );
}
