import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import AppShell from '../components/layout/AppShell';
import {
  Search,
  MapPin,
  Activity,
  Stethoscope,
  Heart,
  BedDouble,
  Thermometer,
  ScanLine,
  LogOut,
  Navigation,
  RefreshCw,
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

type LiveLocationItem = {
  tag_id: string;
  equipment_name: string | null;
  equipment_type: string | null;
  serial_number: string | null;
  reader_id: string;
  location: string;
  rssi: number | null;
  updated_at: number | null;
  is_stale: boolean;
};

type LiveReaderItem = {
  reader_id: string;
  location: string;
};

type EquipmentViewItem = {
  id: string;
  name: string;
  type: string;
  location: string;
  readerId: string;
  updatedAt: number | null;
  isInUse: boolean;
};

const MOCK_READERS: LiveReaderItem[] = [
  { reader_id: 'ER-TRIAGE', location: '응급실' },
  { reader_id: 'ICU-WARD', location: '중환자실' },
  { reader_id: 'M503', location: '수술실' },
  { reader_id: 'M504', location: '영상의학과' },
  { reader_id: 'WARD-7', location: '7병동' },
  { reader_id: 'LAB-2', location: '검사실' },
];

function buildMockLiveItems(now: number): LiveLocationItem[] {
  return [
    {
      tag_id: 'TAG-001',
      equipment_name: '심전도 모니터',
      equipment_type: '응급',
      serial_number: 'DEF-2026-001',
      reader_id: 'ER-TRIAGE',
      location: '응급실',
      rssi: -49,
      updated_at: now - 3,
      is_stale: false,
    },
    {
      tag_id: 'TAG-002',
      equipment_name: '수액펌프',
      equipment_type: '모니터링',
      serial_number: 'MON-2026-011',
      reader_id: 'ICU-WARD',
      location: '중환자실',
      rssi: -55,
      updated_at: now - 7,
      is_stale: false,
    },
    {
      tag_id: 'TAG-003',
      equipment_name: '제세동기',
      equipment_type: '영상',
      serial_number: 'IMG-2026-004',
      reader_id: 'M504',
      location: '영상의학과',
      rssi: -63,
      updated_at: now - 18,
      is_stale: true,
    },
    {
      tag_id: 'TAG-004',
      equipment_name: '인공호흡기',
      equipment_type: '병실',
      serial_number: 'BED-2026-020',
      reader_id: 'WARD-7',
      location: '7병동',
      rssi: -58,
      updated_at: now - 4,
      is_stale: false,
    },
    {
      tag_id: 'TAG-005',
      equipment_name: '이동식 X-ray',
      equipment_type: '측정',
      serial_number: 'TMP-2026-008',
      reader_id: 'LAB-2',
      location: '검사실',
      rssi: -61,
      updated_at: now - 9,
      is_stale: false,
    },
    {
      tag_id: 'TAG-006',
      equipment_name: '초음파기',
      equipment_type: '치료',
      serial_number: 'TRT-2026-005',
      reader_id: 'ICU-WARD',
      location: '중환자실',
      rssi: -67,
      updated_at: now - 24,
      is_stale: true,
    },
    {
      tag_id: 'TAG-007',
      equipment_name: '환자 모니터',
      equipment_type: '모니터링',
      serial_number: 'MON-2026-013',
      reader_id: 'M503',
      location: '수술실',
      rssi: -53,
      updated_at: now - 5,
      is_stale: false,
    },
    {
      tag_id: 'TAG-008',
      equipment_name: '휠체어',
      equipment_type: '응급',
      serial_number: 'DEF-2026-009',
      reader_id: 'ER-TRIAGE',
      location: '응급실',
      rssi: -57,
      updated_at: now - 11,
      is_stale: false,
    },
    {
      tag_id: 'TAG-009',
      equipment_name: '폴대',
      equipment_type: '병실',
      serial_number: 'BED-2026-024',
      reader_id: 'WARD-7',
      location: '7병동',
      rssi: -52,
      updated_at: now - 6,
      is_stale: false,
    },
  ];
}

function getEquipmentIcon(type: string) {
  switch (type) {
    case '모니터링':
      return <Activity className="w-5 h-5" />;
    case '치료':
      return <Heart className="w-5 h-5" />;
    case '응급':
      return <ScanLine className="w-5 h-5" />;
    case '병실':
      return <BedDouble className="w-5 h-5" />;
    case '측정':
      return <Thermometer className="w-5 h-5" />;
    case '영상':
      return <Stethoscope className="w-5 h-5" />;
    default:
      return <Activity className="w-5 h-5" />;
  }
}

function getStatusColor(isInUse: boolean) {
  return isInUse ? 'h-2.5 w-2.5 rounded-full bg-red-500' : 'h-2.5 w-2.5 rounded-full bg-green-500';
}

function getStatusLabel(isInUse: boolean) {
  return isInUse ? '사용 중' : '사용 가능';
}

function formatAgo(updatedAt: number | null) {
  if (!updatedAt) return '미수신';
  const now = Math.floor(Date.now() / 1000);
  const diff = Math.max(0, now - updatedAt);
  if (diff < 5) return '방금';
  if (diff < 60) return `${diff}초 전`;
  const min = Math.floor(diff / 60);
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  return `${hour}시간 전`;
}

export default function EquipmentSearch() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('전체');
  const [selectedLocation, setSelectedLocation] = useState('전체');
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);

  const [liveItems, setLiveItems] = useState<LiveLocationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [lastSyncTs, setLastSyncTs] = useState<number | null>(null);
  const [readerLocations, setReaderLocations] = useState<string[]>([]);
  const [isUsingMockData, setIsUsingMockData] = useState(false);

  const equipment = useMemo<EquipmentViewItem[]>(() => {
    return liveItems.map((item) => ({
      id: item.tag_id,
      name: item.equipment_name?.trim() || item.tag_id,
      type: item.equipment_type?.trim() || '미분류',
      location: item.location || item.reader_id,
      readerId: item.reader_id,
      updatedAt: item.updated_at,
      isInUse: item.reader_id === 'ER-TRIAGE' || item.reader_id === 'ICU-WARD' || item.is_stale,
    }));
  }, [liveItems]);

  const equipmentTypes = useMemo(() => {
    const set = new Set(equipment.map((e) => e.type));
    return ['전체', ...Array.from(set)];
  }, [equipment]);

  const locations = useMemo(() => {
    const set = new Set(equipment.map((e) => e.location));
    return ['전체', ...Array.from(set)];
  }, [equipment]);

  const locationPanels = useMemo(
    () => Array.from(new Set([...readerLocations, ...locations.filter((loc) => loc !== '전체')])),
    [readerLocations, locations],
  );

  const filteredEquipment = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return equipment.filter((item) => {
      const matchesSearch =
        q.length === 0 ||
        item.name.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        item.location.toLowerCase().includes(q);

      const matchesType = selectedType === '전체' || item.type === selectedType;
      const matchesLocation = selectedLocation === '전체' || item.location === selectedLocation;
      return matchesSearch && matchesType && matchesLocation;
    });
  }, [equipment, searchQuery, selectedType, selectedLocation]);

  const inUseCount = useMemo(() => equipment.filter((item) => item.isInUse).length, [equipment]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('auth_user');
      if (!raw) {
        navigate('/', { replace: true });
        return;
      }
      const user = JSON.parse(raw) as { role?: string };
      if (user.role === 'admin') {
        navigate('/verification', { replace: true });
        return;
      }
      if (user.role !== 'staff') {
        navigate('/', { replace: true });
        return;
      }
      setIsAuthorized(true);
    } catch {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    if (!isAuthorized) return;
    let cancelled = false;

    const fetchLiveLocations = async () => {
      setIsRefreshing(true);
      try {
        const response = await fetch(`${API_BASE_URL}/rtls/live`, {
          method: 'GET',
          cache: 'no-store',
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.detail ?? '실시간 위치 데이터를 가져오지 못했습니다.');
        }

        if (cancelled) return;
        const serverItems = Array.isArray(payload.items) ? (payload.items as LiveLocationItem[]) : [];
        const serverReaders = Array.isArray(payload.readers)
          ? (payload.readers as LiveReaderItem[])
              .map((reader) => reader.location)
              .filter((location): location is string => typeof location === 'string' && location.length > 0)
          : [];
        const responseTs = payload.ts ?? Math.floor(Date.now() / 1000);

        if (serverItems.length > 0) {
          setLiveItems(serverItems);
          setReaderLocations(Array.from(new Set(serverReaders)));
          setLastSyncTs(responseTs * 1000);
          setFetchError('');
          setIsUsingMockData(false);
          return;
        }

        setLiveItems(buildMockLiveItems(responseTs));
        setReaderLocations(Array.from(new Set(MOCK_READERS.map((reader) => reader.location))));
        setLastSyncTs(responseTs * 1000);
        setFetchError('');
        setIsUsingMockData(true);
      } catch (err) {
        if (cancelled) return;
        const fallbackTs = Math.floor(Date.now() / 1000);
        setLiveItems(buildMockLiveItems(fallbackTs));
        setReaderLocations(Array.from(new Set(MOCK_READERS.map((reader) => reader.location))));
        setLastSyncTs(fallbackTs * 1000);
        setIsUsingMockData(true);
        if (err instanceof Error) setFetchError(`${err.message} 현재는 예시 데이터를 표시합니다.`);
        else setFetchError('실시간 위치 조회 중 오류가 발생했습니다. 현재는 예시 데이터를 표시합니다.');
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    };

    fetchLiveLocations();
    const intervalId = window.setInterval(fetchLiveLocations, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [isAuthorized]);

  useEffect(() => {
    if (!selectedEquipment) return;
    if (!equipment.some((item) => item.id === selectedEquipment)) {
      setSelectedEquipment(null);
    }
  }, [equipment, selectedEquipment]);

  const selectedItem = filteredEquipment.find((item) => item.id === selectedEquipment) ?? null;

  if (!isAuthorized) {
    return null;
  }

  return (
    <AppShell
      title="장비 검색"
      actions={
        <>
          <div className="hidden md:flex inline-meta__item">
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            {lastSyncTs ? new Date(lastSyncTs).toLocaleTimeString() : '대기 중'}
          </div>
          <Button variant="outline" onClick={() => navigate('/')}>
            <LogOut className="h-4 w-4" />
            로그아웃
          </Button>
        </>
      }
      headerAside={
        <div className="metric-grid">
          <div className="metric-card">
            <div className="metric-label">추적 중인 장비</div>
            <div className="metric-value">{equipment.length}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">활성 위치 구역</div>
            <div className="metric-value">{locationPanels.length}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">사용 중 장비</div>
            <div className="metric-value">{inUseCount}</div>
          </div>
        </div>
      }
    >
      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="space-y-3 fade-rise">
          <div className="surface-panel p-5">
            <div className="panel-header">
              <div>
                <div className="panel-title">장비 위치 검색</div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="태그 ID, 장비명, 위치 검색"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-11"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">장비 유형</label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger>
                    <SelectValue placeholder="유형 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {equipmentTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">위치 필터</label>
                <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                  <SelectTrigger>
                    <SelectValue placeholder="위치 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location} value={location}>
                        {location}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {fetchError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700">
                  {fetchError}
                </div>
              ) : null}
            </div>
          </div>

          <div className="surface-panel p-3">
            <div className="panel-header px-2 pt-2">
              <div>
                <div className="panel-title">장비 목록</div>
                <p className="panel-copy mt-2">{filteredEquipment.length}개 항목이 현재 필터에 맞습니다.</p>
              </div>
            </div>
            <div className="max-h-[720px] space-y-2 overflow-y-auto px-2 pb-2">
              {isLoading ? (
                <div className="empty-state">실시간 데이터 로딩 중입니다.</div>
              ) : filteredEquipment.length === 0 ? (
                <div className="empty-state">
                  <Search className="mx-auto mb-3 h-10 w-10 text-muted-foreground/70" />
                  표시할 실시간 태그가 없습니다.
                </div>
              ) : (
                filteredEquipment.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedEquipment(item.id)}
                    className={`w-full rounded-[1.5rem] border p-4 text-left transition-all ${
                      selectedEquipment === item.id
                        ? 'border-primary/20 bg-white shadow-[0_18px_32px_rgba(0,113,227,0.08)]'
                        : 'border-white/60 bg-white/55 hover:bg-white/78'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="brand-mark h-11 w-11 shrink-0">{getEquipmentIcon(item.type)}</div>
                        <div className="space-y-2">
                          <div>
                            <h3 className="text-[1rem] leading-5">{item.name}</h3>
                            <p className="text-sm text-muted-foreground">{item.id}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                            <span className="inline-flex items-center gap-2">
                              <MapPin className="h-4 w-4" />
                              {item.location}
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className={getStatusColor(item.isInUse)} />
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <Badge variant="outline">{item.type}</Badge>
                      <div className="text-xs text-muted-foreground">
                        상태: {getStatusLabel(item.isInUse)} · 업데이트 {formatAgo(item.updatedAt)}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="space-y-4 fade-rise-delay">
          <div className="surface-panel p-5">
            <div className="panel-header">
              <div>
                <div className="panel-title flex items-center gap-2">
                  <Navigation className="h-5 w-5 text-primary" />
                  리더 위치 패널
                </div>
              </div>
              {selectedItem ? <Badge>{selectedItem.name}</Badge> : <Badge variant="outline">선택 없음</Badge>}
            </div>

            {locationPanels.length === 0 ? (
              <div className="empty-state">아직 수신된 RTLS 위치 데이터가 없습니다.</div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                {locationPanels.map((location) => {
                  const roomItems = filteredEquipment.filter((eq) => eq.location === location);
                  return (
                    <section key={location} className="rounded-[1.6rem] border border-white/70 bg-white/58 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-[1.02rem]">{location}</h3>
                          <p className="mt-1 text-sm text-muted-foreground">{roomItems.length}개 장비 수신</p>
                        </div>
                        <Badge variant="outline">{location}</Badge>
                      </div>
                      <div className="space-y-2">
                        {roomItems.length === 0 ? (
                          <div className="rounded-[1.2rem] border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
                            현재 태그 없음
                          </div>
                        ) : (
                          roomItems.map((eq) => (
                            <button
                              key={eq.id}
                              type="button"
                              onClick={() => setSelectedEquipment(eq.id)}
                              className={`flex w-full items-center justify-between gap-3 rounded-[1.2rem] border px-4 py-3 text-left transition-all ${
                                selectedEquipment === eq.id
                                  ? 'border-primary/20 bg-white shadow-[0_14px_28px_rgba(0,113,227,0.08)]'
                                  : 'border-white/60 bg-white/48 hover:bg-white/76'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="truncate font-medium text-foreground">{eq.name}</div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                  {eq.id} · {formatAgo(eq.updatedAt)}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className={getStatusColor(eq.isInUse)} />
                                <span>{getStatusLabel(eq.isInUse)}</span>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </div>

          <div className="surface-panel p-5">
            <div className="panel-header">
              <div>
                <div className="panel-title">선택 장비 상세</div>
              </div>
            </div>

            {!selectedItem ? (
              <div className="rounded-[1.6rem] border border-dashed border-border px-6 py-10 text-center text-muted-foreground">
                좌측 목록 또는 위치 패널에서 장비를 선택해 주세요.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[1.5rem] border border-white/70 bg-white/58 p-5">
                  <div className="metric-label">장비명</div>
                  <div className="mt-3 text-xl font-semibold tracking-[-0.04em]">{selectedItem.name}</div>
                </div>
                <div className="rounded-[1.5rem] border border-white/70 bg-white/58 p-5">
                  <div className="metric-label">현재 위치</div>
                  <div className="mt-3 text-xl font-semibold tracking-[-0.04em]">{selectedItem.location}</div>
                </div>
                <div className="rounded-[1.5rem] border border-white/70 bg-white/58 p-5">
                  <div className="metric-label">리더 ID</div>
                  <div className="mt-3 text-xl font-semibold tracking-[-0.04em]">{selectedItem.readerId}</div>
                </div>
                <div className="rounded-[1.5rem] border border-white/70 bg-white/58 p-5">
                  <div className="metric-label">업데이트 상태</div>
                  <div className="mt-3 flex items-center gap-3 text-lg font-semibold tracking-[-0.04em]">
                    <span className={getStatusColor(selectedItem.isInUse)} />
                    {getStatusLabel(selectedItem.isInUse)}
                  </div>
                </div>
              </div>
            )}

            {selectedItem ? (
              <div className="mt-4 inline-meta">
                <span className="inline-meta__item">Tag {selectedItem.id}</span>
                <span className="inline-meta__item">마지막 수신 {formatAgo(selectedItem.updatedAt)}</span>
                <span className="inline-meta__item">{selectedItem.type}</span>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
