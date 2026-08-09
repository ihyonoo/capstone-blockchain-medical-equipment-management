// 검색+목록 사이드바 드래그 리사이즈 폭 제한. 너무 좁으면 입력 필드가 찌그러지고,
// 너무 넓으면 지도·구역안내 영역을 침범한다.
export const SIDEBAR_MIN_WIDTH = 320;
export const SIDEBAR_MAX_WIDTH = 640;

export function clampSidebarWidth(width: number): number {
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width));
}
