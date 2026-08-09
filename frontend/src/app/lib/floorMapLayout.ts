// 위치 추적 해상도가 애초에 리더 1대 = 구역 1개라, 구역 안에서의 정확한 실내 좌표는
// 의미가 없다. 그래서 한 구역에 장비가 여러 개 몰려도 무작위로 흩뿌리지 않고, 라벨이
// 서로 가리지 않도록 구역 위치를 중심으로 가로 한 줄로 나란히 배치한다.
export function equipmentRowOffsets(count: number, spacingPct = 7): number[] {
  if (count <= 0) return [];
  const start = -((count - 1) * spacingPct) / 2;
  return Array.from({ length: count }, (_, i) => start + i * spacingPct);
}

export function clampPct(value: number): number {
  return Math.min(100, Math.max(0, value));
}
