import random
import statistics

from simulation import radio


class TestPathLoss:
    def test_one_meter_with_no_walls_is_the_reference_level(self):
        assert radio.path_loss_rssi(1.0, 0.0) == radio.RSSI_AT_1M

    def test_rssi_decreases_monotonically_with_distance(self):
        values = [radio.path_loss_rssi(d, 0.0) for d in (1, 2, 5, 10, 20, 40)]
        assert values == sorted(values, reverse=True)

    def test_each_wall_costs_the_attenuation_constant(self):
        assert radio.path_loss_rssi(10.0, 1.0) == radio.path_loss_rssi(10.0, 0.0) - radio.WALL_ATTENUATION_DB

    def test_fractional_wall_hops_interpolate(self):
        halfway = radio.path_loss_rssi(10.0, 0.5)
        assert radio.path_loss_rssi(10.0, 1.0) < halfway < radio.path_loss_rssi(10.0, 0.0)

    def test_distances_below_one_meter_do_not_exceed_the_reference_level(self):
        assert radio.path_loss_rssi(0.1, 0.0) == radio.RSSI_AT_1M

    def test_same_zone_readings_land_in_the_expected_band(self):
        # 자기 구역(3~8m, 벽 0개)은 -68 ~ -77 dBm 근처여야 한다.
        assert -66 > radio.path_loss_rssi(3.0, 0.0) > -79
        assert -66 > radio.path_loss_rssi(8.0, 0.0) > -79

    def test_adjacent_zone_readings_land_in_the_expected_band(self):
        # 인접 구역(10~20m, 벽 1개)은 -84 ~ -92 dBm 근처여야 한다.
        assert -82 > radio.path_loss_rssi(10.0, 1.0) > -94
        assert -82 > radio.path_loss_rssi(20.0, 1.0) > -94

    def test_two_hops_away_falls_below_the_sensitivity_floor(self):
        assert radio.path_loss_rssi(25.0, 2.0) < radio.RX_SENSITIVITY_DBM


class TestReceptionProbability:
    def test_strong_signals_are_always_received(self):
        assert radio.reception_probability(-70.0) == 1.0

    def test_signals_below_the_sensitivity_floor_are_never_received(self):
        assert radio.reception_probability(-96.0) == 0.0

    def test_probability_decreases_across_the_fade_margin(self):
        assert radio.reception_probability(-86.0) > radio.reception_probability(-93.0) > 0.0

    def test_probability_is_a_valid_probability_everywhere(self):
        for rssi in range(-120, -40):
            assert 0.0 <= radio.reception_probability(float(rssi)) <= 1.0


class TestTagTxOffset:
    def test_is_stable_for_the_same_tag(self):
        assert radio.tag_tx_offset("EQ-0001") == radio.tag_tx_offset("EQ-0001")

    def test_differs_between_tags(self):
        offsets = {radio.tag_tx_offset(f"EQ-{n:04d}") for n in range(50)}
        assert len(offsets) > 40

    def test_stays_within_a_few_decibels(self):
        for n in range(200):
            assert abs(radio.tag_tx_offset(f"EQ-{n:04d}")) < 6.0


class TestSlowFading:
    def test_starts_at_zero_for_an_unseen_pair(self):
        fading = radio.SlowFading()
        key = ("t1", "M101")
        assert key not in fading._state  # 아직 한 번도 안 본 쌍은 내부 상태가 없다 = 0에서 출발
        value = fading.value(key, 0.2, random.Random(1))
        # 0에서 출발해 dt=0.2s만 흐른 첫 샘플이므로 정상상태 표준편차 이내로 작아야 한다.
        assert abs(value) < 3 * radio.SLOW_NOISE_SIGMA_DB

    def test_stays_bounded_over_a_long_run(self):
        fading = radio.SlowFading()
        rng = random.Random(7)
        values = [fading.value(("t1", "M101"), 0.2, rng) for _ in range(5000)]
        assert statistics.stdev(values) < 3.0
        assert max(abs(v) for v in values) < 10.0

    def test_is_correlated_across_adjacent_ticks(self):
        fading = radio.SlowFading()
        rng = random.Random(11)
        previous = fading.value(("t1", "M101"), 0.2, rng)
        for _ in range(50):
            current = fading.value(("t1", "M101"), 0.2, rng)
            assert abs(current - previous) < 2.0  # 200ms 만에 튀지 않는다
            previous = current

    def test_tracks_pairs_independently(self):
        fading = radio.SlowFading()
        rng = random.Random(3)
        for _ in range(100):
            fading.value(("t1", "M101"), 0.2, rng)
            fading.value(("t1", "M102"), 0.2, rng)
        assert fading.value(("t1", "M101"), 0.2, rng) != fading.value(("t1", "M102"), 0.2, rng)


class TestSampleRssi:
    def test_centers_on_the_base_value(self):
        rng = random.Random(5)
        samples = [radio.sample_rssi(-75.0, 0.0, 0.0, rng) for _ in range(4000)]
        assert abs(statistics.fmean(samples) - (-75.0)) < 0.3

    def test_spread_matches_the_fast_noise_sigma(self):
        rng = random.Random(5)
        samples = [radio.sample_rssi(-75.0, 0.0, 0.0, rng) for _ in range(4000)]
        assert abs(statistics.stdev(samples) - radio.FAST_NOISE_SIGMA_DB) < 0.3

    def test_applies_the_tag_and_slow_offsets(self):
        rng = random.Random(5)
        samples = [radio.sample_rssi(-75.0, 2.0, -1.0, rng) for _ in range(4000)]
        assert abs(statistics.fmean(samples) - (-74.0)) < 0.3

    def test_median_of_a_two_second_window_is_much_more_stable_than_one_sample(self):
        rng = random.Random(9)
        medians = [statistics.median([radio.sample_rssi(-75.0, 0.0, 0.0, rng) for _ in range(10)]) for _ in range(400)]
        assert statistics.stdev(medians) < radio.FAST_NOISE_SIGMA_DB / 2
