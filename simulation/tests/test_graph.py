from simulation.topology import graph, zones


class TestDerivedEdges:
    def test_frozen_edge_list_matches_the_geometric_derivation(self):
        # 폴리곤을 고치면 이 테스트가 깨진다 — EDGES를 다시 생성하라는 신호다.
        assert graph.derive_edges() == graph.EDGES

    def test_has_51_edges(self):
        assert len(graph.EDGES) == 51

    def test_every_edge_connects_two_simulated_zones(self):
        for a, b in graph.EDGES:
            assert a in zones.SIM_ZONE_IDS
            assert b in zones.SIM_ZONE_IDS

    def test_edges_never_cross_floors(self):
        for a, b in graph.EDGES:
            assert zones.ZONE_BY_ID[a].floor == zones.ZONE_BY_ID[b].floor

    def test_edge_pairs_are_sorted_and_unique(self):
        assert all(a < b for a, b in graph.EDGES)
        assert len(set(graph.EDGES)) == len(graph.EDGES)


class TestConnectivity:
    def test_every_floor_is_fully_connected(self):
        for floor in range(1, 6):
            ids = [z.reader_id for z in zones.SIM_ZONES if z.floor == floor]
            root = ids[0]
            for other in ids[1:]:
                assert graph.hops(root, other) < graph.HOPS_UNREACHABLE, f"{root}->{other}"

    def test_every_simulated_zone_has_at_least_one_neighbor(self):
        for zone in zones.SIM_ZONES:
            assert graph.NEIGHBORS[zone.reader_id], zone.reader_id


class TestHops:
    def test_distance_to_self_is_zero(self):
        assert graph.hops("M203", "M203") == 0

    def test_direct_neighbors_are_one_hop(self):
        assert graph.hops("M201", "M202") == 1

    def test_hops_are_symmetric(self):
        assert graph.hops("M201", "M212") == graph.hops("M212", "M201")

    def test_zones_on_different_floors_are_unreachable(self):
        assert graph.hops("M201", "M301") == graph.HOPS_UNREACHABLE

    def test_real_hardware_zones_are_not_in_the_graph(self):
        assert graph.hops("M503", "M501") == graph.HOPS_UNREACHABLE


class TestShortestPath:
    def test_path_starts_at_the_origin_and_ends_at_the_destination(self):
        path = graph.shortest_path("M201", "M205")
        assert path[0] == "M201"
        assert path[-1] == "M205"

    def test_consecutive_zones_on_the_path_are_adjacent(self):
        path = graph.shortest_path("M201", "M212")
        for a, b in zip(path, path[1:], strict=False):
            assert b in graph.NEIGHBORS[a], f"{a}->{b}"

    def test_path_length_matches_the_hop_count(self):
        assert len(graph.shortest_path("M201", "M212")) == graph.hops("M201", "M212") + 1

    def test_path_to_self_is_a_single_zone(self):
        assert graph.shortest_path("M203", "M203") == ("M203",)

    def test_unreachable_destination_returns_an_empty_path(self):
        assert graph.shortest_path("M201", "M301") == ()
