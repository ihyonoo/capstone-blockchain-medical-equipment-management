import math
import random

from simulation.topology import geometry

SQUARE = ((0.0, 0.0), (10.0, 0.0), (10.0, 10.0), (0.0, 10.0))


class TestDistance:
    def test_converts_percent_to_meters_using_the_floor_plate_width(self):
        # x축 100%가 FLOOR_PLATE_WIDTH_M(100m)에 대응하므로 10%는 10m다.
        assert geometry.distance_m((0.0, 0.0), (10.0, 0.0)) == 10.0

    def test_y_axis_is_scaled_by_the_image_aspect_ratio(self):
        # 도면 이미지는 930x976px이라 세로 100%가 가로 100%보다 길다.
        assert geometry.distance_m((0.0, 0.0), (0.0, 10.0)) > 10.0

    def test_distance_is_symmetric(self):
        a, b = (12.5, 40.0), (60.0, 8.25)
        assert geometry.distance_m(a, b) == geometry.distance_m(b, a)


class TestCentroid:
    def test_returns_the_center_of_a_square(self):
        assert geometry.centroid(SQUARE) == (5.0, 5.0)


class TestContains:
    def test_point_inside_the_square(self):
        assert geometry.contains(SQUARE, (5.0, 5.0)) is True

    def test_point_outside_the_square(self):
        assert geometry.contains(SQUARE, (15.0, 5.0)) is False

    def test_point_outside_on_the_same_row_as_a_vertex(self):
        # ray casting 구현이 꼭짓점을 두 번 세면 안 된다.
        assert geometry.contains(SQUARE, (-1.0, 0.0)) is False


class TestPolygonGap:
    def test_touching_polygons_have_zero_gap(self):
        other = ((10.0, 0.0), (20.0, 0.0), (20.0, 10.0), (10.0, 10.0))
        assert geometry.polygon_gap_px(SQUARE, other) == 0.0

    def test_separated_polygons_report_the_boundary_distance_in_pixels(self):
        other = ((20.0, 0.0), (30.0, 0.0), (30.0, 10.0), (20.0, 10.0))
        # 10%p 떨어져 있고 이미지 폭이 930px이므로 93px이다.
        assert math.isclose(geometry.polygon_gap_px(SQUARE, other), 93.0, abs_tol=0.01)


class TestRandomPointIn:
    def test_always_returns_a_point_inside_the_polygon(self):
        rng = random.Random(42)
        triangle = ((0.0, 0.0), (10.0, 0.0), (0.0, 10.0))
        for _ in range(200):
            assert geometry.contains(triangle, geometry.random_point_in(triangle, rng)) is True


class TestLerp:
    def test_returns_the_start_at_zero_and_the_end_at_one(self):
        assert geometry.lerp((0.0, 0.0), (10.0, 20.0), 0.0) == (0.0, 0.0)
        assert geometry.lerp((0.0, 0.0), (10.0, 20.0), 1.0) == (10.0, 20.0)

    def test_returns_the_midpoint_at_half(self):
        assert geometry.lerp((0.0, 0.0), (10.0, 20.0), 0.5) == (5.0, 10.0)
