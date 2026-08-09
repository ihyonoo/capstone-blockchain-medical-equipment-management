import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FloorMapView from './FloorMapView';

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

describe('FloorMapView', () => {
  beforeEach(() => {
    mockContainerRect();
  });

  it('renders the floor image for the given floor', () => {
    render(<FloorMapView floor={3} pins={[]} />);
    const img = screen.getByRole('img', { name: '3층 평면도' });
    expect(img).toHaveAttribute('src', '/images/floor-maps/3f.png');
  });

  it('draws no reader marker at all by default — the floor plan already labels every zone', () => {
    render(<FloorMapView floor={1} pins={[{ reader_id: 'M101', label: '주사센터', map_x: 25, map_y: 60 }]} />);

    expect(screen.queryByTestId('floor-map-pin-M101')).not.toBeInTheDocument();
    expect(screen.queryByText('주사센터')).not.toBeInTheDocument();
  });

  it('positions each pin using its map_x/map_y as left/top percentages when showPins is set', () => {
    render(<FloorMapView floor={1} pins={[{ reader_id: 'M101', label: '병동 A', map_x: 25, map_y: 60 }]} showPins />);
    const pin = screen.getByTestId('floor-map-pin-M101');
    expect(pin.style.left).toBe('25%');
    expect(pin.style.top).toBe('60%');
  });

  it('exposes the zone name as a tooltip rather than drawing it, even when pins are shown', () => {
    render(<FloorMapView floor={1} pins={[{ reader_id: 'M101', label: '주사센터', map_x: 25, map_y: 60 }]} showPins />);

    const pin = screen.getByTestId('floor-map-pin-M101');
    expect(pin).toHaveAttribute('title', '주사센터');
    expect(pin).toHaveTextContent('');
    expect(screen.queryByText('주사센터')).not.toBeInTheDocument();
  });

  it('calls onPinClick with the reader id when a pin is clicked', () => {
    const onPinClick = vi.fn();
    render(
      <FloorMapView
        floor={1}
        pins={[{ reader_id: 'M101', label: '병동 A', map_x: 25, map_y: 60 }]}
        onPinClick={onPinClick}
        showPins
      />,
    );
    fireEvent.click(screen.getByTestId('floor-map-pin-M101'));
    expect(onPinClick).toHaveBeenCalledWith('M101');
  });

  it('calls onPendingPlace with the click position converted to percentages when a reader is pending', () => {
    const onPendingPlace = vi.fn();
    render(<FloorMapView floor={1} pins={[]} pendingReaderId="M102" onPendingPlace={onPendingPlace} />);
    fireEvent.click(screen.getByTestId('floor-map-container'), { clientX: 250, clientY: 500 });
    expect(onPendingPlace).toHaveBeenCalledWith(25, 50);
  });

  it('does not fire onPendingPlace when clicking directly on an existing pin', () => {
    const onPendingPlace = vi.fn();
    render(
      <FloorMapView
        floor={1}
        pins={[{ reader_id: 'M101', label: '병동 A', map_x: 25, map_y: 60 }]}
        pendingReaderId="M102"
        onPendingPlace={onPendingPlace}
        showPins
      />,
    );
    fireEvent.click(screen.getByTestId('floor-map-pin-M101'));
    expect(onPendingPlace).not.toHaveBeenCalled();
  });

  it('reports the final position via onPinMoved after a drag', () => {
    const onPinMoved = vi.fn();
    render(
      <FloorMapView
        floor={1}
        pins={[{ reader_id: 'M101', label: '병동 A', map_x: 25, map_y: 60 }]}
        onPinMoved={onPinMoved}
        showPins
      />,
    );
    const pin = screen.getByTestId('floor-map-pin-M101');
    const container = screen.getByTestId('floor-map-container');
    fireEvent.mouseDown(pin);
    fireEvent.mouseMove(container, { clientX: 400, clientY: 700 });
    fireEvent.mouseUp(container);
    expect(onPinMoved).toHaveBeenCalledWith('M101', 40, 70);
  });

  it('renders equipment dots near their reader pin and reports clicks', () => {
    const onEquipmentClick = vi.fn();
    render(
      <FloorMapView
        floor={1}
        pins={[{ reader_id: 'M101', label: '병동 A', map_x: 25, map_y: 60 }]}
        equipment={[{ tag_id: 'EQ-0001', reader_id: 'M101', label: '수액펌프 1호' }]}
        onEquipmentClick={onEquipmentClick}
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
        pins={[{ reader_id: 'M101', label: '병동 A', map_x: 25, map_y: 60 }]}
        equipment={[
          { tag_id: 'EQ-FREE', reader_id: 'M101', label: '수액펌프 1호', assetStatus: 'available' },
          { tag_id: 'EQ-BUSY', reader_id: 'M101', label: '수액펌프 2호', assetStatus: 'checked_out' },
        ]}
      />,
    );

    expect(screen.getByTestId('floor-map-equipment-dot-EQ-FREE')).toHaveClass('map-marker-ok');
    expect(screen.getByTestId('floor-map-equipment-dot-EQ-BUSY')).toHaveClass('map-marker-err');
  });

  it('marks inactive equipment with its own color', () => {
    render(
      <FloorMapView
        floor={1}
        pins={[{ reader_id: 'M101', label: '병동 A', map_x: 25, map_y: 60 }]}
        equipment={[{ tag_id: 'EQ-OFF', reader_id: 'M101', label: '비활성 장비', assetStatus: 'inactive' }]}
      />,
    );

    expect(screen.getByTestId('floor-map-equipment-dot-EQ-OFF')).toHaveClass('map-marker-neutral');
  });

  it('includes the asset status in the equipment tooltip', () => {
    render(
      <FloorMapView
        floor={1}
        pins={[{ reader_id: 'M101', label: '병동 A', map_x: 25, map_y: 60 }]}
        equipment={[{ tag_id: 'EQ-BUSY', reader_id: 'M101', label: '수액펌프 2호', assetStatus: 'checked_out' }]}
      />,
    );

    expect(screen.getByTestId('floor-map-equipment-EQ-BUSY')).toHaveAttribute('title', '수액펌프 2호 · 대여 중');
  });

  it('does not draw a visible label next to the equipment marker — name is tooltip-only', () => {
    render(
      <FloorMapView
        floor={1}
        pins={[{ reader_id: 'M101', label: '병동 A', map_x: 25, map_y: 60 }]}
        equipment={[{ tag_id: 'EQ-0001', reader_id: 'M101', label: '이동형 초음파기기 1호' }]}
      />,
    );

    expect(screen.queryByText('이동형 초음파기기')).not.toBeInTheDocument();
    expect(screen.queryByText('이동형 초음파기기 1호')).not.toBeInTheDocument();
    expect(screen.getByTestId('floor-map-equipment-EQ-0001')).toHaveAttribute(
      'title',
      '이동형 초음파기기 1호 · 사용 가능',
    );
  });

  it('renders equipment dots larger than the old low-visibility size', () => {
    render(
      <FloorMapView
        floor={1}
        pins={[{ reader_id: 'M101', label: '병동 A', map_x: 25, map_y: 60 }]}
        equipment={[{ tag_id: 'EQ-0001', reader_id: 'M101', label: '수액펌프 1호' }]}
      />,
    );

    const dot = screen.getByTestId('floor-map-equipment-dot-EQ-0001');
    expect(dot.style.width).toBe('18px');
    expect(dot.style.height).toBe('18px');
  });

  it('lines up multiple equipment at the same reader in a row instead of overlapping them', () => {
    render(
      <FloorMapView
        floor={1}
        pins={[{ reader_id: 'M101', label: '병동 A', map_x: 50, map_y: 60 }]}
        equipment={[
          { tag_id: 'EQ-0001', reader_id: 'M101', label: '제세동기' },
          { tag_id: 'EQ-0002', reader_id: 'M101', label: '환자모니터 1호' },
          { tag_id: 'EQ-0003', reader_id: 'M101', label: '인공호흡기 1호' },
        ]}
      />,
    );

    const first = screen.getByTestId('floor-map-equipment-EQ-0001');
    const second = screen.getByTestId('floor-map-equipment-EQ-0002');
    const third = screen.getByTestId('floor-map-equipment-EQ-0003');

    // 셋 다 같은 y(구역 위치)에, x만 겹치지 않게 일정 간격으로 벌어져 나란히 놓인다.
    expect(first.style.top).toBe(second.style.top);
    expect(second.style.top).toBe(third.style.top);
    const lefts = [first, second, third].map((el) => parseFloat(el.style.left));
    expect(new Set(lefts).size).toBe(3);
    expect(lefts[1] - lefts[0]).toBeCloseTo(lefts[2] - lefts[1]);
  });

  it('renders a highlight marker at the given zone position when highlightedZone is set', () => {
    render(<FloorMapView floor={1} pins={[]} highlightedZone={{ id: '1f-cafe', label: '카페', mapX: 19, mapY: 57 }} />);

    const highlight = screen.getByTestId('floor-map-highlight-1f-cafe');
    expect(highlight.style.left).toBe('19%');
    expect(highlight.style.top).toBe('57%');
  });

  it('renders no highlight marker when highlightedZone is not set', () => {
    render(<FloorMapView floor={1} pins={[]} />);
    expect(screen.queryByTestId(/floor-map-highlight-/)).not.toBeInTheDocument();
  });
});
