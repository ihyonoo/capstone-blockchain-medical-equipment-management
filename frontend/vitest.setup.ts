import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom에는 IntersectionObserver가 없어, motion의 whileInView가 마운트 시 에러를 던진다.
class IntersectionObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// @ts-expect-error jsdom does not implement IntersectionObserver
globalThis.IntersectionObserver = IntersectionObserverMock;

// vite.config.ts가 test.globals를 켜지 않아 Testing Library의 자동 cleanup이 동작하지 않는다.
// 이걸 켜지 않으면 한 파일 안에 여러 render()가 있을 때 이전 테스트의 DOM이 남아
// 다음 테스트의 getByText 등이 중복 매치로 실패한다.
afterEach(() => cleanup());
