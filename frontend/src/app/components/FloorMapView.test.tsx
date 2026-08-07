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

  it('positions each pin using its map_x/map_y as left/top percentages', () => {
    render(<FloorMapView floor={1} pins={[{ reader_id: 'M101', label: '병동 A', map_x: 25, map_y: 60 }]} />);
    const pin = screen.getByTestId('floor-map-pin-M101');
    expect(pin.style.left).toBe('25%');
    expect(pin.style.top).toBe('60%');
  });

  it('calls onPinClick with the reader id when a pin is clicked', () => {
    const onPinClick = vi.fn();
    render(
      <FloorMapView
        floor={1}
        pins={[{ reader_id: 'M101', label: '병동 A', map_x: 25, map_y: 60 }]}
        onPinClick={onPinClick}
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
});
