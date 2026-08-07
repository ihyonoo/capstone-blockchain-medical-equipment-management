-- database/seed_demo_topology.sql
-- simulation/generate_topology.py가 simulation/demo_data.py로부터 생성했다(정적 산출물,
-- 수동 수정하지 말 것 — 데이터를 바꾸려면 demo_data.py를 고치고 다시 생성한다).
-- 순천향대학교 천안병원 본관 1~5층 실제 부서 구성을 본뜬 모의(시뮬레이션) 리더/장비/staff.
-- 전부 is_real_hardware = FALSE로 표시되어 실물(M501/M502, 실물 태그)과 구분된다.
-- 멱등적(ON CONFLICT DO NOTHING) — 재실행해도 안전하다.

BEGIN;

INSERT INTO readers (reader_id, location_name, is_real_hardware) VALUES
    ('M101', '소아전용응급의료센터 진료구역', FALSE),
    ('M102', '소아전용응급의료센터 처치실', FALSE),
    ('M103', '충남권역응급의료센터 진료구역', FALSE),
    ('M104', '응급 소생실', FALSE),
    ('M105', '의료영상센터 CT실', FALSE),
    ('M106', '의료영상센터 X-ray실', FALSE),
    ('M107', '의료영상센터 초음파실', FALSE),
    ('M108', '외래약국', FALSE),
    ('M109', '원무/행정팀', FALSE),
    ('M110', '의무기록/협력센터', FALSE),
    ('M201', '채혈/호흡기검사실', FALSE),
    ('M202', '심장내과검사실', FALSE),
    ('M203', '암센터/종양혈액내과 외래', FALSE),
    ('M204', '주사센터', FALSE),
    ('M205', '호흡기센터', FALSE),
    ('M206', '심장혈관센터', FALSE),
    ('M207', '응급중환자실', FALSE),
    ('M208', '신경과센터', FALSE),
    ('M209', '소화기/내시경센터', FALSE),
    ('M210', '정신건강의학센터', FALSE),
    ('M301', '가정의학과', FALSE),
    ('M302', '당뇨/내분비내과', FALSE),
    ('M303', '유방/갑상선센터', FALSE),
    ('M304', '감염내과센터', FALSE),
    ('M305', '이비인후과', FALSE),
    ('M306', '치과', FALSE),
    ('M307', '안과', FALSE),
    ('M308', '정형외과/척추센터', FALSE),
    ('M309', '통증/재활/류마티스센터', FALSE),
    ('M310', '비뇨의학과', FALSE),
    ('M311', '피부/성형외과 클리닉', FALSE),
    ('M401', '진단검사의학과 검체접수실', FALSE),
    ('M402', '진단검사의학과 자동화검사실', FALSE),
    ('M403', '소아재활/특수센터', FALSE),
    ('M404', '모체태아의학/고위험산과', FALSE),
    ('M405', '여성건강센터', FALSE),
    ('M406', '병리과', FALSE),
    ('M407', '장기이식센터', FALSE),
    ('M408', '신장/투석센터 투석실A', FALSE),
    ('M409', '신장/투석센터 투석실B', FALSE),
    ('M503', '외과계중환자실', FALSE),
    ('M504', '심장내과중환자실', FALSE),
    ('M505', '마취통증의학과 준비구역', FALSE),
    ('M506', '외래수술센터 회복실', FALSE),
    ('M507', '본관수술센터 회복실', FALSE),
    ('M508', '충남권역심뇌혈관센터 진료구역', FALSE),
    ('M509', '충남권역심뇌혈관센터 시술실', FALSE),
    ('M510', '내과계중환자실', FALSE),
    ('M511', '본관수술센터 준비구역', FALSE),
    ('M512', '외래수술센터 준비구역', FALSE)
ON CONFLICT (reader_id) DO NOTHING;

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
