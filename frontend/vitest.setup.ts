import '@testing-library/jest-dom/vitest';

// jsdom에는 IntersectionObserver가 없어, motion의 whileInView가 마운트 시 에러를 던진다.
class IntersectionObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// @ts-expect-error jsdom does not implement IntersectionObserver
globalThis.IntersectionObserver = IntersectionObserverMock;
