import { useCallback, useRef, useState, type ReactNode } from 'react';
import { getFloorMapInfo, type FloorNumber } from '../lib/floorMaps';
import { clampPct, equipmentRowOffsets } from '../lib/floorMapLayout';

export type FloorMapPin = {
  reader_id: string;
  label: string;
  map_x: number;
  map_y: number;
  badge?: ReactNode;
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

// 목록·뱃지 등 앱 전체가 공유하는 dot-* 톤은 차분하게 잡혀 있어 지도 위 9px 점으로는
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
  onPinClick?: (readerId: string) => void;
  onPinMoved?: (readerId: string, mapX: number, mapY: number) => void;
  pendingReaderId?: string | null;
  onPendingPlace?: (mapX: number, mapY: number) => void;
  // 한 구역에 장비가 여러 개일 때 마커를 나란히 벌리는 간격(퍼센트).
  rowSpacingPct?: number;
  // 구역 표식은 좌표를 배치·확인하는 관리자 핀 편집기에서만 필요하다. 직원용 지도에서는
  // 평면도에 이미 구역명이 인쇄돼 있어 장비 점만 그린다.
  showPins?: boolean;
  highlightedZone?: FloorMapHighlight | null;
};

function percentFromEvent(container: HTMLElement, clientX: number, clientY: number) {
  const rect = container.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
  return {
    x: clampPct(((clientX - rect.left) / rect.width) * 100),
    y: clampPct(((clientY - rect.top) / rect.height) * 100),
  };
}

export default function FloorMapView({
  floor,
  pins,
  equipment = [],
  onEquipmentClick,
  onPinClick,
  onPinMoved,
  pendingReaderId = null,
  onPendingPlace,
  rowSpacingPct = 7,
  showPins = false,
  highlightedZone = null,
}: FloorMapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [draggingReaderId, setDraggingReaderId] = useState<string | null>(null);
  const [dragPct, setDragPct] = useState<{ x: number; y: number } | null>(null);
  const floorInfo = getFloorMapInfo(floor);

  const handleContainerClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!pendingReaderId || !onPendingPlace || !containerRef.current) return;
      if ((event.target as HTMLElement).closest('[data-floor-map-pin]')) return;
      const pct = percentFromEvent(containerRef.current, event.clientX, event.clientY);
      onPendingPlace(pct.x, pct.y);
    },
    [pendingReaderId, onPendingPlace],
  );

  const handlePinMouseDown = useCallback(
    (readerId: string) => (event: React.MouseEvent) => {
      if (!onPinMoved) return;
      event.stopPropagation();
      setDraggingReaderId(readerId);
    },
    [onPinMoved],
  );

  const handleContainerMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!draggingReaderId || !containerRef.current) return;
      setDragPct(percentFromEvent(containerRef.current, event.clientX, event.clientY));
    },
    [draggingReaderId],
  );

  const stopDragging = useCallback(() => {
    if (draggingReaderId && dragPct && onPinMoved) {
      onPinMoved(draggingReaderId, dragPct.x, dragPct.y);
    }
    setDraggingReaderId(null);
    setDragPct(null);
  }, [draggingReaderId, dragPct, onPinMoved]);

  const equipmentByReader = new Map<string, FloorMapEquipmentDot[]>();
  for (const dot of equipment) {
    const list = equipmentByReader.get(dot.reader_id) ?? [];
    list.push(dot);
    equipmentByReader.set(dot.reader_id, list);
  }

  return (
    <div
      ref={containerRef}
      data-testid="floor-map-container"
      className="relative w-full select-none overflow-hidden rounded-lg border border-border bg-card"
      onClick={handleContainerClick}
      onMouseMove={handleContainerMouseMove}
      onMouseUp={stopDragging}
      onMouseLeave={stopDragging}
    >
      <img src={floorInfo.imagePath} alt={`${floorInfo.label} 평면도`} className="block w-full" draggable={false} />

      {(showPins ? pins : []).map((pin) => {
        const isDragging = draggingReaderId === pin.reader_id;
        const x = isDragging && dragPct ? dragPct.x : pin.map_x;
        const y = isDragging && dragPct ? dragPct.y : pin.map_y;
        return (
          <button
            key={pin.reader_id}
            type="button"
            data-floor-map-pin
            data-testid={`floor-map-pin-${pin.reader_id}`}
            // 구역명은 평면도 이미지에 이미 인쇄돼 있으므로 핀은 표식만 그리고
            // 이름은 툴팁(title)으로만 노출한다.
            title={pin.label}
            aria-label={pin.label}
            className="absolute -translate-x-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full border-2 border-primary bg-background shadow-sm"
            style={{ left: `${x}%`, top: `${y}%`, cursor: onPinMoved ? 'grab' : 'pointer' }}
            onMouseDown={handlePinMouseDown(pin.reader_id)}
            onClick={(event) => {
              event.stopPropagation();
              onPinClick?.(pin.reader_id);
            }}
          >
            {pin.badge ? <span className="absolute -right-1.5 -top-1.5">{pin.badge}</span> : null}
          </button>
        );
      })}

      {pins.map((pin) => {
        // tag_id로 정렬해 순서를 고정한다 — 폴링마다 API가 주는 배열 순서가 바뀌어도
        // 같은 장비가 같은 자리에 그대로 있어야 자연스럽다.
        const dots = [...(equipmentByReader.get(pin.reader_id) ?? [])].sort((a, b) => a.tag_id.localeCompare(b.tag_id));
        const offsets = equipmentRowOffsets(dots.length, rowSpacingPct);
        return dots.map((dot, index) => {
          const x = clampPct(pin.map_x + offsets[index]);
          const y = pin.map_y;
          const status = assetStatusDot(dot.assetStatus);
          return (
            <button
              key={dot.tag_id}
              type="button"
              data-testid={`floor-map-equipment-${dot.tag_id}`}
              title={`${dot.label} · ${status.label}`}
              aria-label={`${dot.label} · ${status.label}`}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${x}%`, top: `${y}%` }}
              onClick={(event) => {
                event.stopPropagation();
                onEquipmentClick?.(dot.tag_id);
              }}
            >
              <span
                data-testid={`floor-map-equipment-dot-${dot.tag_id}`}
                className={`block rounded-full ring-2 ring-background ${status.className}`}
                style={{ width: 18, height: 18 }}
              >
                {dot.badge}
              </span>
            </button>
          );
        });
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
