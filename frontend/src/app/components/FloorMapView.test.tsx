import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import FloorMapView from './FloorMapView';
import type { ZonePoint } from '../lib/floorMapLayout';

function mockContainerRect() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 1000,
    bottom: 1000,
    width: 1000,
    height: 1000,
    toJSON: () => {},
  });
}

const SQUARE_BOUNDS: Record<string, ZonePoint[]> = {
  M101: [
    { x: 20, y: 50 },
    { x: 30, y: 50 },
    { x: 30, y: 60 },
    { x: 20, y: 60 },
  ],
};

describe('FloorMapView', () => {
  beforeEach(() => {
    mockContainerRect();
  });

  it('renders the floor image for the given floor', () => {
    render(<FloorMapView floor={3} pins={[]} zoneBounds={{}} />);
    const img = screen.getByRole('img', { name: '3층 평면도' });
    expect(img).toHaveAttribute('src', '/images/floor-maps/3f.png');
  });

  it('draws no reader marker at all by default — the floor plan already labels every zone', () => {
    render(<FloorMapView floor={1} pins={[{ reader_id: 'M101', label: '주사센터' }]} zoneBounds={{}} />);

    expect(screen.queryByTestId('floor-map-pin-M101')).not.toBeInTheDocument();
    expect(screen.queryByText('주사센터')).not.toBeInTheDocument();
  });

  it('renders equipment dots near their reader pin and reports clicks', () => {
    const onEquipmentClick = vi.fn();
    render(
      <FloorMapView
        floor={1}
        pins={[{ reader_id: 'M101', label: '병동 A' }]}
        equipment={[{ tag_id: 'EQ-0001', reader_id: 'M101', label: '수액펌프 1호' }]}
        onEquipmentClick={onEquipmentClick}
        zoneBounds={SQUARE_BOUNDS}
      />,
    );
    const dot = screen.getByTestId('floor-map-equipment-EQ-0001');
    expect(dot).toBeInTheDocument();
    fireEvent.click(dot);
    expect(onEquipmentClick).toHaveBeenCalledWith('EQ-0001');
  });

  it('colors a checked-out equipment dot differently from an available one', () => {
    render(
      <FloorMapView
        floor={1}
        pins={[{ reader_id: 'M101', label: '병동 A' }]}
        equipment={[
          { tag_id: 'EQ-FREE', reader_id: 'M101', label: '수액펌프 1호', assetStatus: 'available' },
          { tag_id: 'EQ-BUSY', reader_id: 'M101', label: '수액펌프 2호', assetStatus: 'checked_out' },
        ]}
        zoneBounds={SQUARE_BOUNDS}
      />,
    );

    expect(screen.getByTestId('floor-map-equipment-dot-EQ-FREE')).toHaveClass('map-marker-ok');
    expect(screen.getByTestId('floor-map-equipment-dot-EQ-BUSY')).toHaveClass('map-marker-err');
  });

  it('marks inactive equipment with its own color', () => {
    render(
      <FloorMapView
        floor={1}
        pins={[{ reader_id: 'M101', label: '병동 A' }]}
        equipment={[{ tag_id: 'EQ-OFF', reader_id: 'M101', label: '비활성 장비', assetStatus: 'inactive' }]}
        zoneBounds={SQUARE_BOUNDS}
      />,
    );

    expect(screen.getByTestId('floor-map-equipment-dot-EQ-OFF')).toHaveClass('map-marker-neutral');
  });

  it('includes the asset status in the equipment tooltip', () => {
    render(
      <FloorMapView
        floor={1}
        pins={[{ reader_id: 'M101', label: '병동 A' }]}
        equipment={[{ tag_id: 'EQ-BUSY', reader_id: 'M101', label: '수액펌프 2호', assetStatus: 'checked_out' }]}
        zoneBounds={SQUARE_BOUNDS}
      />,
    );

    expect(screen.getByTestId('floor-map-equipment-EQ-BUSY')).toHaveAttribute('title', '수액펌프 2호 · 대여 중');
  });

  it('does not draw a visible label next to the equipment marker — name is tooltip-only', () => {
    render(
      <FloorMapView
        floor={1}
        pins={[{ reader_id: 'M101', label: '병동 A' }]}
        equipment={[{ tag_id: 'EQ-0001', reader_id: 'M101', label: '이동형 초음파기기 1호' }]}
        zoneBounds={SQUARE_BOUNDS}
      />,
    );

    expect(screen.queryByText('이동형 초음파기기')).not.toBeInTheDocument();
    expect(screen.queryByText('이동형 초음파기기 1호')).not.toBeInTheDocument();
    expect(screen.getByTestId('floor-map-equipment-EQ-0001')).toHaveAttribute(
      'title',
      '이동형 초음파기기 1호 · 사용 가능',
    );
  });

  it('renders equipment dots at 14px with no background ring', () => {
    render(
      <FloorMapView
        floor={1}
        pins={[{ reader_id: 'M101', label: '병동 A' }]}
        equipment={[{ tag_id: 'EQ-0001', reader_id: 'M101', label: '수액펌프 1호' }]}
        zoneBounds={SQUARE_BOUNDS}
      />,
    );

    const dot = screen.getByTestId('floor-map-equipment-dot-EQ-0001');
    expect(dot.style.width).toBe('14px');
    expect(dot.style.height).toBe('14px');
    expect(dot.className).not.toContain('ring-background');
  });

  it('renders a highlight marker at the given zone position when highlightedZone is set', () => {
    render(
      <FloorMapView
        floor={1}
        pins={[]}
        zoneBounds={{}}
        highlightedZone={{ id: '1f-cafe', label: '카페', mapX: 19, mapY: 57 }}
      />,
    );

    const highlight = screen.getByTestId('floor-map-highlight-1f-cafe');
    expect(highlight.style.left).toBe('19%');
    expect(highlight.style.top).toBe('57%');
  });

  it('renders no highlight marker when highlightedZone is not set', () => {
    render(<FloorMapView floor={1} pins={[]} zoneBounds={{}} />);
    expect(screen.queryByTestId(/floor-map-highlight-/)).not.toBeInTheDocument();
  });

  it('places a single equipment dot inside its zone polygon', () => {
    render(
      <FloorMapView
        floor={1}
        pins={[{ reader_id: 'M101', label: '병동 A' }]}
        equipment={[{ tag_id: 'EQ-0001', reader_id: 'M101', label: '수액펌프 1호' }]}
        zoneBounds={SQUARE_BOUNDS}
      />,
    );
    const dot = screen.getByTestId('floor-map-equipment-EQ-0001');
    const left = parseFloat(dot.style.left);
    const top = parseFloat(dot.style.top);
    expect(left).toBeGreaterThanOrEqual(20);
    expect(left).toBeLessThanOrEqual(30);
    expect(top).toBeGreaterThanOrEqual(50);
    expect(top).toBeLessThanOrEqual(60);
  });

  it('does not draw anything for a reader with no traced polygon', () => {
    render(
      <FloorMapView
        floor={1}
        pins={[{ reader_id: 'M999', label: '경계 없는 구역' }]}
        equipment={[{ tag_id: 'EQ-0002', reader_id: 'M999', label: '장비' }]}
        zoneBounds={{}}
      />,
    );
    expect(screen.queryByTestId('floor-map-equipment-EQ-0002')).not.toBeInTheDocument();
  });

  it('shows the equipment name label above the dot when clicked, and hides it on a second click', () => {
    render(
      <FloorMapView
        floor={1}
        pins={[{ reader_id: 'M101', label: '병동 A' }]}
        equipment={[{ tag_id: 'EQ-0001', reader_id: 'M101', label: '수액펌프 1호' }]}
        zoneBounds={SQUARE_BOUNDS}
      />,
    );
    expect(screen.queryByTestId('floor-map-equipment-label-EQ-0001')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('floor-map-equipment-EQ-0001'));
    expect(screen.getByTestId('floor-map-equipment-label-EQ-0001')).toHaveTextContent('수액펌프 1호');

    fireEvent.click(screen.getByTestId('floor-map-equipment-EQ-0001'));
    expect(screen.queryByTestId('floor-map-equipment-label-EQ-0001')).not.toBeInTheDocument();
  });

  it('places multiple equipment inside the same zone polygon without lining them up in a row', () => {
    const roomyBounds: Record<string, ZonePoint[]> = {
      M101: [
        { x: 10, y: 10 },
        { x: 40, y: 10 },
        { x: 40, y: 40 },
        { x: 10, y: 40 },
      ],
    };
    render(
      <FloorMapView
        floor={1}
        pins={[{ reader_id: 'M101', label: '병동 A' }]}
        equipment={[
          { tag_id: 'EQ-0001', reader_id: 'M101', label: '제세동기' },
          { tag_id: 'EQ-0002', reader_id: 'M101', label: '환자모니터' },
        ]}
        zoneBounds={roomyBounds}
      />,
    );
    const first = screen.getByTestId('floor-map-equipment-EQ-0001');
    const second = screen.getByTestId('floor-map-equipment-EQ-0002');
    for (const el of [first, second]) {
      const left = parseFloat(el.style.left);
      const top = parseFloat(el.style.top);
      expect(left).toBeGreaterThanOrEqual(10);
      expect(left).toBeLessThanOrEqual(40);
      expect(top).toBeGreaterThanOrEqual(10);
      expect(top).toBeLessThanOrEqual(40);
    }
    expect(first.style.left === second.style.left && first.style.top === second.style.top).toBe(false);
  });

  it('clusters equipment into a +N badge once the zone is too small to show them all individually, and expands the list on click', () => {
    const tinyBounds: Record<string, ZonePoint[]> = {
      M101: [
        { x: 10, y: 10 },
        { x: 12, y: 10 },
        { x: 12, y: 12 },
        { x: 10, y: 12 },
      ],
    };
    render(
      <FloorMapView
        floor={1}
        pins={[{ reader_id: 'M101', label: '병동 A' }]}
        equipment={[
          { tag_id: 'EQ-0001', reader_id: 'M101', label: '제세동기', assetStatus: 'available' },
          { tag_id: 'EQ-0002', reader_id: 'M101', label: '환자모니터', assetStatus: 'checked_out' },
          { tag_id: 'EQ-0003', reader_id: 'M101', label: '인공호흡기', assetStatus: 'available' },
        ]}
        zoneBounds={tinyBounds}
      />,
    );
    // 2x2 퍼센트짜리 방은 maxVisibleForPolygon이 1이라, 3개 전부 배지 하나로 뭉친다.
    const badge = screen.getByTestId('floor-map-cluster-M101');
    expect(badge).toHaveTextContent('+3');
    expect(screen.queryByTestId('floor-map-cluster-list-M101')).not.toBeInTheDocument();

    fireEvent.click(badge);
    const list = screen.getByTestId('floor-map-cluster-list-M101');
    expect(within(list).getByTestId('floor-map-cluster-item-EQ-0001')).toHaveTextContent('제세동기');
    expect(within(list).getByTestId('floor-map-cluster-item-EQ-0002')).toHaveTextContent('환자모니터');
    expect(within(list).getByTestId('floor-map-cluster-item-EQ-0003')).toHaveTextContent('인공호흡기');

    fireEvent.click(badge);
    expect(screen.queryByTestId('floor-map-cluster-list-M101')).not.toBeInTheDocument();
  });

  it('closes the name label when a cluster badge elsewhere is opened (single active overlay)', () => {
    const bounds: Record<string, ZonePoint[]> = {
      M101: [
        { x: 10, y: 10 },
        { x: 40, y: 10 },
        { x: 40, y: 40 },
        { x: 10, y: 40 },
      ],
      M102: [
        { x: 10, y: 10.1 },
        { x: 12, y: 10.1 },
        { x: 12, y: 12.1 },
        { x: 10, y: 12.1 },
      ],
    };
    render(
      <FloorMapView
        floor={1}
        pins={[
          { reader_id: 'M101', label: '병동 A' },
          { reader_id: 'M102', label: '병동 B' },
        ]}
        equipment={[
          { tag_id: 'EQ-0001', reader_id: 'M101', label: '단일 장비' },
          { tag_id: 'EQ-0002', reader_id: 'M102', label: '장비2' },
          { tag_id: 'EQ-0003', reader_id: 'M102', label: '장비3' },
        ]}
        zoneBounds={bounds}
      />,
    );
    fireEvent.click(screen.getByTestId('floor-map-equipment-EQ-0001'));
    expect(screen.getByTestId('floor-map-equipment-label-EQ-0001')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('floor-map-cluster-M102'));
    expect(screen.queryByTestId('floor-map-equipment-label-EQ-0001')).not.toBeInTheDocument();
    expect(screen.getByTestId('floor-map-cluster-list-M102')).toBeInTheDocument();
  });
});
