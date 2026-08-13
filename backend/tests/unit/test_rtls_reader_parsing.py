"""실물 리더의 iBeacon → tag_id 변환 단위 테스트.

리더 모듈은 bleak(BLE 스택)을 import하는데 개발/CI 환경에는 설치돼 있지 않다.
파싱 자체는 순수 함수라, bleak만 스텁으로 끼워 넣고 모듈을 불러온다.
"""

import importlib.util
import sys
import types
from pathlib import Path

import pytest

READER_PATH = Path(__file__).resolve().parents[3] / "rtls" / "rtls_reader" / "send_to_server.py"


def _load_reader_module():
    stub = types.ModuleType("bleak")
    stub.BleakScanner = object
    sys.modules.setdefault("bleak", stub)
    spec = importlib.util.spec_from_file_location("rtls_send_to_server", READER_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


reader = _load_reader_module()


class FakeAdvertisement:
    """bleak의 AdvertisementData 중 파서가 실제로 읽는 필드만 흉내낸다."""

    def __init__(self, manufacturer_data):
        self.manufacturer_data = manufacturer_data


def build_ibeacon_payload(uuid_hex: str, major: int, minor: int) -> bytes:
    return bytes([0x02, 0x15]) + bytes.fromhex(uuid_hex) + major.to_bytes(2, "big") + minor.to_bytes(2, "big") + b"\xc5"


REAL_UUID_HEX = "fda50693a4e24fb1afcfc6eb07647825"
REAL_UUID = "fda50693-a4e2-4fb1-afcf-c6eb07647825"


class TestParseIBeaconTagId:
    def test_pads_the_minor_to_three_digits(self):
        adv = FakeAdvertisement({0x004C: build_ibeacon_payload(REAL_UUID_HEX, 1, 1)})

        assert reader.parse_ibeacon_tag_id(adv) == f"{REAL_UUID}:1:001"

    @pytest.mark.parametrize(
        ("minor", "expected"),
        [(2, "002"), (50, "050"), (999, "999")],
    )
    def test_keeps_three_digit_width_across_the_range(self, minor, expected):
        adv = FakeAdvertisement({0x004C: build_ibeacon_payload(REAL_UUID_HEX, 1, minor)})

        assert reader.parse_ibeacon_tag_id(adv) == f"{REAL_UUID}:1:{expected}"

    def test_leaves_the_major_untouched(self):
        adv = FakeAdvertisement({0x004C: build_ibeacon_payload(REAL_UUID_HEX, 1, 7)})

        assert reader.parse_ibeacon_tag_id(adv).split(":")[1] == "1"

    def test_ignores_advertisements_without_apple_manufacturer_data(self):
        assert reader.parse_ibeacon_tag_id(FakeAdvertisement({})) is None

    def test_ignores_apple_payloads_that_are_not_ibeacon(self):
        adv = FakeAdvertisement({0x004C: bytes([0x10, 0x05]) + b"\x00" * 20})

        assert reader.parse_ibeacon_tag_id(adv) is None
