import { useState, type ReactNode } from 'react';
import { getFloorMapInfo, type FloorNumber } from '../lib/floorMaps';
import {
  maxVisibleForPolygon,
  placeInPolygon,
  pointInPolygon,
  polygonCentroid,
  type ZonePoint,
} from '../lib/floorMapLayout';

export type FloorMapPin = {
  reader_id: string;
  label: string;
};

export type FloorMapEquipmentDot = {
  tag_id: string;
  reader_id: string;
  label: string;
  assetStatus?: string;
  badge?: ReactNode;
};

// 리더가 없는 구역(구역 안내 패널의 편의시설 항목 등)을 클릭했을 때 지도 위에서
// 위치만 짚어주기 위한 표식. 핀·장비 점과 달리 필터링할 장비가 없다.
export type FloorMapHighlight = {
  id: string;
  label: string;
  mapX: number;
  mapY: number;
};

// 목록·뱃지 등 앱 전체가 공유하는 dot-* 톤은 차분하게 잡혀 있어 지도 위 작은 점으로는
// 잘 안 보인다. 지도에서만 쓰는 더 밝은 색(theme.css의 map-marker-*)을 따로 둔다 —
// 공유 톤을 바꾸면 뱃지·범례 등 다른 화면 색상까지 같이 바뀌기 때문.
const ASSET_STATUS_DOT: Record<string, { className: string; label: string }> = {
  checked_out: { className: 'map-marker-err', label: '대여 중' },
  inactive: { className: 'map-marker-neutral', label: '비활성' },
  available: { className: 'map-marker-ok', label: '사용 가능' },
};

function assetStatusDot(status: string | undefined) {
  return ASSET_STATUS_DOT[status ?? 'available'] ?? ASSET_STATUS_DOT.available;
}

type FloorMapViewProps = {
  floor: FloorNumber;
  pins: FloorMapPin[];
  equipment?: FloorMapEquipmentDot[];
  onEquipmentClick?: (tagId: string) => void;
  zoneBounds: Record<string, ZonePoint[]>;
  highlightedZone?: FloorMapHighlight | null;
};

function renderEquipmentMarker(
  dot: FloorMapEquipmentDot,
  position: ZonePoint,
  activeMarkerId: string | null,
  toggleMarker: (id: string) => void,
  onEquipmentClick?: (tagId: string) => void,
) {
  const status = assetStatusDot(dot.assetStatus);
  const isActive = activeMarkerId === dot.tag_id;
  return (
    <div key={dot.tag_id}>
      <button
        type="button"
        data-testid={`floor-map-equipment-${dot.tag_id}`}
        title={`${dot.label} · ${status.label}`}
        aria-label={`${dot.label} · ${status.label}`}
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${position.x}%`, top: `${position.y}%` }}
        onClick={() => {
          toggleMarker(dot.tag_id);
          onEquipmentClick?.(dot.tag_id);
        }}
      >
        <span
          data-testid={`floor-map-equipment-dot-${dot.tag_id}`}
          className={`block rounded-full ${status.className}`}
          style={{ width: 14, height: 14 }}
        >
          {dot.badge}
        </span>
      </button>
      {isActive ? (
        <span
          data-testid={`floor-map-equipment-label-${dot.tag_id}`}
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-full bg-foreground px-2 py-0.5 text-xs text-background"
          style={{ left: `${position.x}%`, top: `${position.y - 3}%` }}
        >
          {dot.label}
        </span>
      ) : null}
    </div>
  );
}

export default function FloorMapView({
  floor,
  pins,
  equipment = [],
  onEquipmentClick,
  zoneBounds,
  highlightedZone = null,
}: FloorMapViewProps) {
  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);
  const floorInfo = getFloorMapInfo(floor);

  const toggleMarker = (id: string) => {
    setActiveMarkerId((prev) => (prev === id ? null : id));
  };

  const equipmentByReader = new Map<string, FloorMapEquipmentDot[]>();
  for (const dot of equipment) {
    const list = equipmentByReader.get(dot.reader_id) ?? [];
    list.push(dot);
    equipmentByReader.set(dot.reader_id, list);
  }

  return (
    <div
      data-testid="floor-map-container"
      className="relative w-full select-none overflow-hidden rounded-lg border border-border bg-card"
    >
      <img src={floorInfo.imagePath} alt={`${floorInfo.label} 평면도`} className="block w-full" draggable={false} />

      {pins.map((pin) => {
        const dots = [...(equipmentByReader.get(pin.reader_id) ?? [])].sort((a, b) => a.tag_id.localeCompare(b.tag_id));
        if (dots.length === 0) return null;
        const polygon = zoneBounds[pin.reader_id];
        if (!polygon || polygon.length < 3) return null;

        if (dots.length === 1) {
          const dot = dots[0];
          const centroid = polygonCentroid(polygon);
          const position = pointInPolygon(centroid, polygon) ? centroid : polygon[0];
          return renderEquipmentMarker(dot, position, activeMarkerId, toggleMarker, onEquipmentClick);
        }

        const maxVisible = maxVisibleForPolygon(polygon);
        const visibleDots = dots.length <= maxVisible ? dots : dots.slice(0, maxVisible - 1);
        const hiddenDots = dots.length <= maxVisible ? [] : dots.slice(maxVisible - 1);

        const taken: ZonePoint[] = [];
        const placed = visibleDots.map((dot) => {
          const position = placeInPolygon(polygon, dot.tag_id, taken);
          taken.push(position);
          return { dot, position };
        });

        const clusterId = `cluster:${pin.reader_id}`;
        const isClusterActive = activeMarkerId === clusterId;
        const clusterPosition = hiddenDots.length > 0 ? polygonCentroid(polygon) : null;

        return (
          <div key={pin.reader_id}>
            {placed.map(({ dot, position }) =>
              renderEquipmentMarker(dot, position, activeMarkerId, toggleMarker, onEquipmentClick),
            )}
            {clusterPosition ? (
              <div>
                <button
                  type="button"
                  data-testid={`floor-map-cluster-${pin.reader_id}`}
                  aria-label={`장비 ${hiddenDots.length}개 더보기`}
                  className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-foreground px-1.5 text-xs text-background"
                  style={{
                    left: `${clusterPosition.x}%`,
                    top: `${clusterPosition.y}%`,
                    minWidth: 14,
                    height: 14,
                    lineHeight: '14px',
                  }}
                  onClick={() => toggleMarker(clusterId)}
                >
                  +{hiddenDots.length}
                </button>
                {isClusterActive ? (
                  <div
                    data-testid={`floor-map-cluster-list-${pin.reader_id}`}
                    className="absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-border bg-card p-2 text-xs shadow-md"
                    style={{ left: `${clusterPosition.x}%`, top: `${clusterPosition.y - 3}%` }}
                  >
                    {hiddenDots.map((dot) => {
                      const status = assetStatusDot(dot.assetStatus);
                      return (
                        <div
                          key={dot.tag_id}
                          data-testid={`floor-map-cluster-item-${dot.tag_id}`}
                          className="flex items-center gap-1.5 whitespace-nowrap py-0.5"
                        >
                          <span className={`inline-block h-2 w-2 rounded-full ${status.className}`} />
                          {dot.label}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}

      {highlightedZone ? (
        <span
          data-testid={`floor-map-highlight-${highlightedZone.id}`}
          aria-hidden="true"
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${highlightedZone.mapX}%`, top: `${highlightedZone.mapY}%` }}
        >
          <span className="absolute inset-0 -m-2 animate-ping rounded-full bg-primary/50" />
          <span className="relative block h-6 w-6 rounded-full border-2 border-primary bg-primary/20" />
        </span>
      ) : null}
    </div>
  );
}
