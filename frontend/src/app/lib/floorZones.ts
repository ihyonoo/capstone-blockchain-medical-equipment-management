// 리더(BLE 추적)가 없는 편의시설 구역 — 순천향대학교 천안병원 평면도(floor-maps 이미지)에
// 인쇄된 이름을 그대로 쓴다. 장비가 놓일 일이 없어 demo_data.py의 리더 목록에는 없지만,
// "이 층에 뭐가 있는지" 안내에는 필요하다.
//
// 좌표는 리더 없는 이미지 위 라벨 위치를 보고 percent로 눈대중 환산했다. 관리자 핀
// 편집기(리더 전용)의 대상이 아니므로, 어긋나 보이면 이 값을 직접 고친다.
import type { FloorNumber } from './floorMaps';

export type AmenityZone = {
  id: string;
  floor: FloorNumber;
  name: string;
  mapX: number;
  mapY: number;
};

export const AMENITY_ZONES: AmenityZone[] = [
  { id: '1f-kiosk', floor: 1, name: '무인 서류발급기·CD기', mapX: 32, mapY: 14 },
  { id: '1f-document', floor: 1, name: '서류발급', mapX: 34, mapY: 34 },
  { id: '1f-exam-booking', floor: 1, name: '검사예약', mapX: 38, mapY: 43 },
  { id: '1f-cafe', floor: 1, name: '카페', mapX: 19, mapY: 57 },
  { id: '1f-gate1', floor: 1, name: 'GATE1', mapX: 28, mapY: 60 },
  { id: '1f-gate2', floor: 1, name: 'GATE2', mapX: 49, mapY: 88 },
  { id: '1f-gate3', floor: 1, name: 'GATE3', mapX: 51, mapY: 3 },
  { id: '1f-pharmacy', floor: 1, name: '외래약국', mapX: 47.0, mapY: 22.0 },
  { id: '1f-admin-desk', floor: 1, name: '원무팀', mapX: 39.0, mapY: 25.0 },
  { id: '1f-referral-center', floor: 1, name: '진료협력센터', mapX: 21.0, mapY: 41.0 },
  { id: '2f-admin-desk', floor: 2, name: '원무팀', mapX: 35, mapY: 42 },
  { id: '3f-admin-desk', floor: 3, name: '원무팀', mapX: 35, mapY: 43 },
  { id: '5f-waiting-1', floor: 5, name: '보호자대기실', mapX: 42, mapY: 31 },
  { id: '5f-waiting-2', floor: 5, name: '보호자대기실', mapX: 38, mapY: 38 },
  { id: '5f-rapid-response', floor: 5, name: '신속대응팀', mapX: 30, mapY: 39 },
  { id: '5f-recovery-room', floor: 5, name: '회복실', mapX: 43.5, mapY: 68.0 },
];

export function getAmenityZonesForFloor(floor: FloorNumber): AmenityZone[] {
  return AMENITY_ZONES.filter((zone) => zone.floor === floor);
}
