-- database/seed_demo_topology.sql
-- simulation/generate_topology.py가 simulation/demo_data.py로부터 생성했다(정적 산출물,
-- 수동 수정하지 말 것 — 데이터를 바꾸려면 demo_data.py를 고치고 다시 생성한다).
-- 순천향대학교 천안병원 본관 1~5층 실제 부서 구성을 본뜬 모의(시뮬레이션) 리더/장비/staff.
-- 전부 is_real_hardware = FALSE로 표시되어 실물(M501/M502, 실물 태그)과 구분된다.
-- 멱등적 — 재실행해도 안전하고, 관리자가 핀 편집기로 옮긴 좌표를 덮어쓰지 않는다.

BEGIN;

INSERT INTO readers (reader_id, location_name, floor, map_x, map_y, is_real_hardware) VALUES
    ('M101', '소아전용응급의료센터 진료구역', 1, 66.0, 8.0, FALSE),
    ('M102', '소아전용응급의료센터 처치실', 1, 76.0, 11.5, FALSE),
    ('M103', '충남권역응급의료센터 진료구역', 1, 65.0, 28.0, FALSE),
    ('M104', '응급 소생실', 1, 73.0, 36.5, FALSE),
    ('M105', '의료영상센터 CT실', 1, 62.0, 65.0, FALSE),
    ('M106', '의료영상센터 X-ray실', 1, 71.0, 71.0, FALSE),
    ('M107', '의료영상센터 초음파실', 1, 65.0, 78.0, FALSE),
    ('M108', '외래약국', 1, 47.0, 22.0, FALSE),
    ('M109', '원무/행정팀', 1, 39.0, 25.0, FALSE),
    ('M110', '의무기록/협력센터', 1, 21.0, 41.0, FALSE),
    ('M201', '채혈/호흡기검사실', 2, 13.5, 39.0, FALSE),
    ('M202', '심장내과검사실', 2, 35.0, 28.0, FALSE),
    ('M203', '암센터/종양혈액내과 외래', 2, 44.5, 18.0, FALSE),
    ('M204', '주사센터', 2, 68.0, 7.0, FALSE),
    ('M205', '호흡기센터', 2, 66.0, 15.5, FALSE),
    ('M206', '심장혈관센터', 2, 66.0, 23.0, FALSE),
    ('M207', '응급중환자실', 2, 70.0, 33.0, FALSE),
    ('M208', '신경과센터', 2, 66.0, 51.0, FALSE),
    ('M209', '소화기/내시경센터', 2, 67.0, 77.0, FALSE),
    ('M210', '정신건강의학센터', 2, 69.0, 90.0, FALSE),
    ('M301', '가정의학과', 3, 21.5, 40.0, FALSE),
    ('M302', '당뇨/내분비내과', 3, 28.5, 32.0, FALSE),
    ('M303', '유방/갑상선센터', 3, 39.0, 24.5, FALSE),
    ('M304', '감염내과센터', 3, 44.5, 15.0, FALSE),
    ('M305', '이비인후과', 3, 66.0, 9.0, FALSE),
    ('M306', '치과', 3, 65.0, 17.0, FALSE),
    ('M307', '안과', 3, 69.0, 30.0, FALSE),
    ('M308', '정형외과/척추센터', 3, 66.0, 45.0, FALSE),
    ('M309', '통증/재활/류마티스센터', 3, 66.0, 56.0, FALSE),
    ('M310', '비뇨의학과', 3, 66.0, 67.0, FALSE),
    ('M311', '피부/성형외과 클리닉', 3, 66.0, 77.0, FALSE),
    ('M401', '진단검사의학과 검체접수실', 4, 27.0, 34.0, FALSE),
    ('M402', '진단검사의학과 자동화검사실', 4, 32.0, 41.0, FALSE),
    ('M403', '소아재활/특수센터', 4, 44.0, 18.0, FALSE),
    ('M404', '모체태아의학/고위험산과', 4, 71.5, 35.0, FALSE),
    ('M405', '여성건강센터', 4, 66.0, 49.0, FALSE),
    ('M406', '병리과', 4, 69.0, 61.5, FALSE),
    ('M407', '장기이식센터', 4, 56.5, 67.0, FALSE),
    ('M408', '신장/투석센터 투석실A', 4, 63.0, 72.0, FALSE),
    ('M409', '신장/투석센터 투석실B', 4, 70.0, 82.0, FALSE),
    ('M503', '외과계중환자실', 5, 29.0, 30.0, FALSE),
    ('M504', '심장내과중환자실', 5, 64.0, 7.0, FALSE),
    ('M505', '마취통증의학과 준비구역', 5, 31.0, 48.0, FALSE),
    ('M506', '외래수술센터 회복실', 5, 56.0, 55.0, FALSE),
    ('M507', '본관수술센터 회복실', 5, 43.5, 68.0, FALSE),
    ('M508', '충남권역심뇌혈관센터 진료구역', 5, 60.0, 19.5, FALSE),
    ('M509', '충남권역심뇌혈관센터 시술실', 5, 69.0, 22.0, FALSE),
    ('M510', '내과계중환자실', 5, 85.5, 7.0, FALSE),
    ('M511', '본관수술센터 준비구역', 5, 66.0, 63.0, FALSE),
    ('M512', '외래수술센터 준비구역', 5, 63.0, 50.5, FALSE)
ON CONFLICT (reader_id) DO NOTHING;

-- 좌표 없이 먼저 시딩된 DB를 위한 보정(map_x IS NULL인 행만).
UPDATE readers SET floor = 1, map_x = 66.0, map_y = 8.0, updated_at = now()
    WHERE reader_id = 'M101' AND map_x IS NULL;
UPDATE readers SET floor = 1, map_x = 76.0, map_y = 11.5, updated_at = now()
    WHERE reader_id = 'M102' AND map_x IS NULL;
UPDATE readers SET floor = 1, map_x = 65.0, map_y = 28.0, updated_at = now()
    WHERE reader_id = 'M103' AND map_x IS NULL;
UPDATE readers SET floor = 1, map_x = 73.0, map_y = 36.5, updated_at = now()
    WHERE reader_id = 'M104' AND map_x IS NULL;
UPDATE readers SET floor = 1, map_x = 62.0, map_y = 65.0, updated_at = now()
    WHERE reader_id = 'M105' AND map_x IS NULL;
UPDATE readers SET floor = 1, map_x = 71.0, map_y = 71.0, updated_at = now()
    WHERE reader_id = 'M106' AND map_x IS NULL;
UPDATE readers SET floor = 1, map_x = 65.0, map_y = 78.0, updated_at = now()
    WHERE reader_id = 'M107' AND map_x IS NULL;
UPDATE readers SET floor = 1, map_x = 47.0, map_y = 22.0, updated_at = now()
    WHERE reader_id = 'M108' AND map_x IS NULL;
UPDATE readers SET floor = 1, map_x = 39.0, map_y = 25.0, updated_at = now()
    WHERE reader_id = 'M109' AND map_x IS NULL;
UPDATE readers SET floor = 1, map_x = 21.0, map_y = 41.0, updated_at = now()
    WHERE reader_id = 'M110' AND map_x IS NULL;
UPDATE readers SET floor = 2, map_x = 13.5, map_y = 39.0, updated_at = now()
    WHERE reader_id = 'M201' AND map_x IS NULL;
UPDATE readers SET floor = 2, map_x = 35.0, map_y = 28.0, updated_at = now()
    WHERE reader_id = 'M202' AND map_x IS NULL;
UPDATE readers SET floor = 2, map_x = 44.5, map_y = 18.0, updated_at = now()
    WHERE reader_id = 'M203' AND map_x IS NULL;
UPDATE readers SET floor = 2, map_x = 68.0, map_y = 7.0, updated_at = now()
    WHERE reader_id = 'M204' AND map_x IS NULL;
UPDATE readers SET floor = 2, map_x = 66.0, map_y = 15.5, updated_at = now()
    WHERE reader_id = 'M205' AND map_x IS NULL;
UPDATE readers SET floor = 2, map_x = 66.0, map_y = 23.0, updated_at = now()
    WHERE reader_id = 'M206' AND map_x IS NULL;
UPDATE readers SET floor = 2, map_x = 70.0, map_y = 33.0, updated_at = now()
    WHERE reader_id = 'M207' AND map_x IS NULL;
UPDATE readers SET floor = 2, map_x = 66.0, map_y = 51.0, updated_at = now()
    WHERE reader_id = 'M208' AND map_x IS NULL;
UPDATE readers SET floor = 2, map_x = 67.0, map_y = 77.0, updated_at = now()
    WHERE reader_id = 'M209' AND map_x IS NULL;
UPDATE readers SET floor = 2, map_x = 69.0, map_y = 90.0, updated_at = now()
    WHERE reader_id = 'M210' AND map_x IS NULL;
UPDATE readers SET floor = 3, map_x = 21.5, map_y = 40.0, updated_at = now()
    WHERE reader_id = 'M301' AND map_x IS NULL;
UPDATE readers SET floor = 3, map_x = 28.5, map_y = 32.0, updated_at = now()
    WHERE reader_id = 'M302' AND map_x IS NULL;
UPDATE readers SET floor = 3, map_x = 39.0, map_y = 24.5, updated_at = now()
    WHERE reader_id = 'M303' AND map_x IS NULL;
UPDATE readers SET floor = 3, map_x = 44.5, map_y = 15.0, updated_at = now()
    WHERE reader_id = 'M304' AND map_x IS NULL;
UPDATE readers SET floor = 3, map_x = 66.0, map_y = 9.0, updated_at = now()
    WHERE reader_id = 'M305' AND map_x IS NULL;
UPDATE readers SET floor = 3, map_x = 65.0, map_y = 17.0, updated_at = now()
    WHERE reader_id = 'M306' AND map_x IS NULL;
UPDATE readers SET floor = 3, map_x = 69.0, map_y = 30.0, updated_at = now()
    WHERE reader_id = 'M307' AND map_x IS NULL;
UPDATE readers SET floor = 3, map_x = 66.0, map_y = 45.0, updated_at = now()
    WHERE reader_id = 'M308' AND map_x IS NULL;
UPDATE readers SET floor = 3, map_x = 66.0, map_y = 56.0, updated_at = now()
    WHERE reader_id = 'M309' AND map_x IS NULL;
UPDATE readers SET floor = 3, map_x = 66.0, map_y = 67.0, updated_at = now()
    WHERE reader_id = 'M310' AND map_x IS NULL;
UPDATE readers SET floor = 3, map_x = 66.0, map_y = 77.0, updated_at = now()
    WHERE reader_id = 'M311' AND map_x IS NULL;
UPDATE readers SET floor = 4, map_x = 27.0, map_y = 34.0, updated_at = now()
    WHERE reader_id = 'M401' AND map_x IS NULL;
UPDATE readers SET floor = 4, map_x = 32.0, map_y = 41.0, updated_at = now()
    WHERE reader_id = 'M402' AND map_x IS NULL;
UPDATE readers SET floor = 4, map_x = 44.0, map_y = 18.0, updated_at = now()
    WHERE reader_id = 'M403' AND map_x IS NULL;
UPDATE readers SET floor = 4, map_x = 71.5, map_y = 35.0, updated_at = now()
    WHERE reader_id = 'M404' AND map_x IS NULL;
UPDATE readers SET floor = 4, map_x = 66.0, map_y = 49.0, updated_at = now()
    WHERE reader_id = 'M405' AND map_x IS NULL;
UPDATE readers SET floor = 4, map_x = 69.0, map_y = 61.5, updated_at = now()
    WHERE reader_id = 'M406' AND map_x IS NULL;
UPDATE readers SET floor = 4, map_x = 56.5, map_y = 67.0, updated_at = now()
    WHERE reader_id = 'M407' AND map_x IS NULL;
UPDATE readers SET floor = 4, map_x = 63.0, map_y = 72.0, updated_at = now()
    WHERE reader_id = 'M408' AND map_x IS NULL;
UPDATE readers SET floor = 4, map_x = 70.0, map_y = 82.0, updated_at = now()
    WHERE reader_id = 'M409' AND map_x IS NULL;
UPDATE readers SET floor = 5, map_x = 29.0, map_y = 30.0, updated_at = now()
    WHERE reader_id = 'M503' AND map_x IS NULL;
UPDATE readers SET floor = 5, map_x = 64.0, map_y = 7.0, updated_at = now()
    WHERE reader_id = 'M504' AND map_x IS NULL;
UPDATE readers SET floor = 5, map_x = 31.0, map_y = 48.0, updated_at = now()
    WHERE reader_id = 'M505' AND map_x IS NULL;
UPDATE readers SET floor = 5, map_x = 56.0, map_y = 55.0, updated_at = now()
    WHERE reader_id = 'M506' AND map_x IS NULL;
UPDATE readers SET floor = 5, map_x = 43.5, map_y = 68.0, updated_at = now()
    WHERE reader_id = 'M507' AND map_x IS NULL;
UPDATE readers SET floor = 5, map_x = 60.0, map_y = 19.5, updated_at = now()
    WHERE reader_id = 'M508' AND map_x IS NULL;
UPDATE readers SET floor = 5, map_x = 69.0, map_y = 22.0, updated_at = now()
    WHERE reader_id = 'M509' AND map_x IS NULL;
UPDATE readers SET floor = 5, map_x = 85.5, map_y = 7.0, updated_at = now()
    WHERE reader_id = 'M510' AND map_x IS NULL;
UPDATE readers SET floor = 5, map_x = 66.0, map_y = 63.0, updated_at = now()
    WHERE reader_id = 'M511' AND map_x IS NULL;
UPDATE readers SET floor = 5, map_x = 63.0, map_y = 50.5, updated_at = now()
    WHERE reader_id = 'M512' AND map_x IS NULL;

-- 실물 하드웨어 리더의 위치/좌표(생성이 아니라 표시 정보 보정).
INSERT INTO readers (reader_id, location_name, floor, map_x, map_y) VALUES
    ('M501', '수술실', 5, 71.0, 68.0)
ON CONFLICT (reader_id) DO NOTHING;

UPDATE readers SET floor = 5, map_x = 71.0, map_y = 68.0, updated_at = now()
    WHERE reader_id = 'M501' AND map_x IS NULL;

UPDATE readers SET location_name = '수술실', updated_at = now()
    WHERE reader_id = 'M501' AND location_name = 'M501';

INSERT INTO readers (reader_id, location_name, floor, map_x, map_y) VALUES
    ('M502', '영상의학과', 1, 74.0, 78.0)
ON CONFLICT (reader_id) DO NOTHING;

UPDATE readers SET floor = 1, map_x = 74.0, map_y = 78.0, updated_at = now()
    WHERE reader_id = 'M502' AND map_x IS NULL;

UPDATE readers SET location_name = '영상의학과', updated_at = now()
    WHERE reader_id = 'M502' AND location_name = 'M502';

INSERT INTO tags (
    tag_id, equipment_name, equipment_type, serial_number, nfc_tag_uid, asset_status, is_real_hardware
) VALUES
    ('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:1:0001', '이동형 환자모니터 1호', '환자모니터', 'BME-2021-00001', '04000000000001', 'available', FALSE),
    ('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:1:0002', '소아용 제세동기 2호', '제세동기', 'BME-2022-00002', '04000000000002', 'available', FALSE),
    ('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:1:0003', '제세동기 3호', '제세동기', 'BME-2023-00003', '04000000000003', 'available', FALSE),
    ('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:1:0004', '이동형 환자모니터 4호', '환자모니터', 'BME-2024-00004', '04000000000004', 'available', FALSE),
    ('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:1:0005', '이동형 인공호흡기 5호', '인공호흡기', 'BME-2020-00005', '04000000000005', 'available', FALSE),
    ('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:1:0006', '조영제 자동주입기 6호', '조영제주입기', 'BME-2021-00006', '04000000000006', 'available', FALSE),
    ('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:1:0007', '이동형 X-ray 촬영장비 7호', '이동형 X-ray', 'BME-2022-00007', '04000000000007', 'available', FALSE),
    ('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:1:0008', '휴대용 초음파기기 8호', '초음파진단기', 'BME-2023-00008', '04000000000008', 'available', FALSE),
    ('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:1:0009', '이동형 약품관리 카트 9호', '약품관리카트', 'BME-2024-00009', '04000000000009', 'available', FALSE),
    ('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:1:0010', '무선 자산관리 스캐너 10호', '자산관리스캐너', 'BME-2020-00010', '0400000000000A', 'available', FALSE),
    ('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:2:0011', '이동형 폐기능검사기 11호', '폐기능검사기', 'BME-2021-00011', '0400000000000B', 'available', FALSE),
    ('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:2:0012', '이동형 심전도기 12호', '심전도기', 'BME-2022-00012', '0400000000000C', 'available', FALSE),
    ('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:2:0013', '수액펌프 13호', '인퓨전펌프', 'BME-2023-00013', '0400000000000D', 'available', FALSE),
    ('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:2:0014', '수액펌프 14호', '인퓨전펌프', 'BME-2024-00014', '0400000000000E', 'available', FALSE),
    ('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:2:0015', '수액펌프 15호', '인퓨전펌프', 'BME-2020-00015', '0400000000000F', 'available', FALSE),
    ('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:2:0016', '이동형 산소포화도 모니터 16호', '환자모니터', 'BME-2021-00016', '04000000000010', 'available', FALSE),
    ('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:2:0017', '휴대용 심장초음파기 17호', '초음파진단기', 'BME-2022-00017', '04000000000011', 'available', FALSE),
    ('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:2:0018', '제세동기 18호', '제세동기', 'BME-2023-00018', '04000000000012', 'available', FALSE),
    ('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:2:0019', '이동형 인공호흡기 19호', '인공호흡기', 'BME-2024-00019', '04000000000013', 'available', FALSE),
    ('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:2:0020', '내시경 세척/보관 카트 20호', '내시경카트', 'BME-2020-00020', '04000000000014', 'available', FALSE),
    ('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:3:0021', '이동형 혈당측정 카트 21호', '혈당측정카트', 'BME-2021-00021', '04000000000015', 'available', FALSE),
    ('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:3:0022', '휴대용 초음파기기 22호', '초음파진단기', 'BME-2022-00022', '04000000000016', 'available', FALSE),
    ('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:3:0023', '이동형 격리병동용 모니터 23호', '환자모니터', 'BME-2023-00023', '04000000000017', 'available', FALSE),
    ('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:3:0024', '이비인후과 진단 카트 24호', '진단카트', 'BME-2024-00024', '04000000000018', 'available', FALSE),
    ('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:3:0025', '세극등/안압계 이동카트 25호', '안과진단카트', 'BME-2020-00025', '04000000000019', 'available', FALSE),
    ('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:3:0026', '이동형 C-arm 보조장비 26호', 'C-arm', 'BME-2021-00026', '0400000000001A', 'available', FALSE),
    ('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:3:0027', '재활용 전기자극치료기 27호', '전기자극치료기', 'BME-2022-00027', '0400000000001B', 'available', FALSE),
    ('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:3:0028', '이동형 초음파기기 28호', '초음파진단기', 'BME-2023-00028', '0400000000001C', 'available', FALSE),
    ('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:4:0029', '검체이송 카트 29호', '검체이송카트', 'BME-2024-00029', '0400000000001D', 'available', FALSE),
    ('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:4:0030', '이동형 원심분리기 30호', '원심분리기', 'BME-2020-00030', '0400000000001E', 'available', FALSE),
    ('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:4:0031', '소아재활 보조기기 31호', '재활보조기기', 'BME-2021-00031', '0400000000001F', 'available', FALSE),
    ('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:4:0032', '태아모니터 32호', '태아모니터', 'BME-2022-00032', '04000000000020', 'available', FALSE),
    ('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:4:0033', '태아모니터 33호', '태아모니터', 'BME-2023-00033', '04000000000021', 'available', FALSE),
    ('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:4:0034', '휴대용 초음파기기 34호', '초음파진단기', 'BME-2024-00034', '04000000000022', 'available', FALSE),
    ('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:4:0035', '이동형 환자모니터 35호', '환자모니터', 'BME-2020-00035', '04000000000023', 'available', FALSE),
    ('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:4:0036', '혈액투석기 36호', '혈액투석기', 'BME-2021-00036', '04000000000024', 'available', FALSE),
    ('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:4:0037', '혈액투석기 37호', '혈액투석기', 'BME-2022-00037', '04000000000025', 'available', FALSE),
    ('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:4:0038', '혈액투석기 38호', '혈액투석기', 'BME-2023-00038', '04000000000026', 'available', FALSE),
    ('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:4:0039', '혈액투석기 39호', '혈액투석기', 'BME-2024-00039', '04000000000027', 'available', FALSE),
    ('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:5:0040', '이동형 인공호흡기 40호', '인공호흡기', 'BME-2020-00040', '04000000000028', 'available', FALSE),
    ('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:5:0041', '환자모니터 41호', '환자모니터', 'BME-2021-00041', '04000000000029', 'available', FALSE),
    ('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:5:0042', '제세동기 42호', '제세동기', 'BME-2022-00042', '0400000000002A', 'available', FALSE),
    ('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:5:0043', '이동형 마취기 43호', '마취기', 'BME-2023-00043', '0400000000002B', 'available', FALSE),
    ('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:5:0044', '이동형 환자모니터 44호', '환자모니터', 'BME-2024-00044', '0400000000002C', 'available', FALSE),
    ('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:5:0045', '제세동기 45호', '제세동기', 'BME-2020-00045', '0400000000002D', 'available', FALSE),
    ('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:5:0046', '환자모니터 46호', '환자모니터', 'BME-2021-00046', '0400000000002E', 'available', FALSE),
    ('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:5:0047', '휴대용 심초음파기 47호', '초음파진단기', 'BME-2022-00047', '0400000000002F', 'available', FALSE),
    ('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:5:0048', 'C-arm 혈관조영 보조장비 48호', 'C-arm', 'BME-2023-00048', '04000000000030', 'available', FALSE),
    ('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:5:0049', '이동형 인공호흡기 49호', '인공호흡기', 'BME-2024-00049', '04000000000031', 'available', FALSE),
    ('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:5:0050', '환자모니터 50호', '환자모니터', 'BME-2020-00050', '04000000000032', 'available', FALSE)
ON CONFLICT (tag_id) DO NOTHING;

INSERT INTO users (
    username, display_name, role, department, position,
    password_hash, is_active, email_verified, email, is_real_hardware
) VALUES
    ('parksh07', '박수현', 'staff', '간호부', '수간호사', 'x', TRUE, TRUE, 'parksh07@sch-cheonan.local', FALSE),
    ('kimjy23', '김지영', 'staff', '간호부', '간호사', 'x', TRUE, TRUE, 'kimjy23@sch-cheonan.local', FALSE),
    ('leedh91', '이동혁', 'staff', '영상의학과', '방사선사', 'x', TRUE, TRUE, 'leedh91@sch-cheonan.local', FALSE),
    ('choiej15', '최은주', 'staff', '의공학팀', '의공기사', 'x', TRUE, TRUE, 'choiej15@sch-cheonan.local', FALSE),
    ('jungwc42', '정우철', 'staff', '응급의료센터', '응급구조사', 'x', TRUE, TRUE, 'jungwc42@sch-cheonan.local', FALSE)
ON CONFLICT (username) DO NOTHING;

COMMIT;
