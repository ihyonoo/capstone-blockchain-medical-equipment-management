import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
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
  Shield,
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
  rssi: number | null;
  updatedAt: number | null;
  isStale: boolean;
};

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

function getStatusColor(isStale: boolean) {
  return isStale ? 'bg-red-500' : 'bg-green-500';
}

function getStatusLabel(isStale: boolean) {
  return isStale ? '신호 약함/지연' : '추적 중';
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

  const [liveItems, setLiveItems] = useState<LiveLocationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [lastSyncTs, setLastSyncTs] = useState<number | null>(null);
  const [readerLocations, setReaderLocations] = useState<string[]>([]);

  const equipment = useMemo<EquipmentViewItem[]>(() => {
    return liveItems.map((item) => ({
      id: item.tag_id,
      name: item.equipment_name?.trim() || item.tag_id,
      type: item.equipment_type?.trim() || '미분류',
      location: item.location || item.reader_id,
      readerId: item.reader_id,
      rssi: item.rssi,
      updatedAt: item.updated_at,
      isStale: item.is_stale,
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

  useEffect(() => {
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
        setLiveItems(Array.isArray(payload.items) ? payload.items : []);
        const locationsFromReaders = Array.isArray(payload.readers)
          ? (payload.readers as LiveReaderItem[])
              .map((reader) => reader.location)
              .filter((location): location is string => typeof location === 'string' && location.length > 0)
          : [];
        setReaderLocations(Array.from(new Set(locationsFromReaders)));
        setLastSyncTs((payload.ts ?? Math.floor(Date.now() / 1000)) * 1000);
        setFetchError('');
      } catch (err) {
        if (cancelled) return;
        if (err instanceof Error) setFetchError(err.message);
        else setFetchError('실시간 위치 조회 중 오류가 발생했습니다.');
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
  }, []);

  useEffect(() => {
    if (!selectedEquipment) return;
    if (!equipment.some((item) => item.id === selectedEquipment)) {
      setSelectedEquipment(null);
    }
  }, [equipment, selectedEquipment]);

  const selectedItem = filteredEquipment.find((item) => item.id === selectedEquipment) ?? null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white shadow-md border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <MapPin className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">블록체인 기반 의료 장비 관리 시스템</h1>
                <p className="text-sm text-gray-600">RTLS 기반 실시간 태그 위치</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Button variant="outline" onClick={() => navigate('/verification')} className="flex items-center space-x-2">
                <Shield className="w-4 h-4" />
                <span>무결성 검증</span>
              </Button>
              <Button variant="outline" onClick={() => navigate('/')} className="flex items-center space-x-2">
                <LogOut className="w-4 h-4" />
                <span>로그아웃</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center space-x-2">
                    <Search className="w-5 h-5" />
                    <span>실시간 장비 검색</span>
                  </span>
                  <span className="flex items-center space-x-1 text-xs text-gray-500">
                    <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                    <span>{lastSyncTs ? new Date(lastSyncTs).toLocaleTimeString() : '-'}</span>
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    placeholder="태그ID/장비명/위치 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
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
                  <label className="text-sm font-medium">위치별 필터</label>
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

                {fetchError && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {fetchError}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>태그 목록 ({filteredEquipment.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 max-h-[600px] overflow-y-auto">
                {isLoading ? (
                  <div className="text-center py-8 text-gray-500">로딩 중...</div>
                ) : filteredEquipment.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Search className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p>표시할 실시간 태그가 없습니다</p>
                  </div>
                ) : (
                  filteredEquipment.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedEquipment(item.id)}
                      className={`w-full p-4 border rounded-lg text-left transition-all hover:shadow-md ${
                        selectedEquipment === item.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                            {getEquipmentIcon(item.type)}
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900">{item.name}</h4>
                            <p className="text-xs text-gray-500">{item.id}</p>
                          </div>
                        </div>
                        <div className={`w-2 h-2 rounded-full ${getStatusColor(item.isStale)} mt-2`} />
                      </div>

                      <div className="space-y-1 text-sm">
                        <div className="flex items-center space-x-2 text-gray-600">
                          <MapPin className="w-4 h-4" />
                          <span>{item.location}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary" className="text-xs">
                            {item.type}
                          </Badge>
                          <span className="text-xs text-gray-500">RSSI {item.rssi ?? '-'}</span>
                        </div>
                        <p className="text-xs text-gray-500">
                          상태: {getStatusLabel(item.isStale)} / 업데이트: {formatAgo(item.updatedAt)}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card className="h-full min-h-[800px]">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Navigation className="w-5 h-5" />
                    <span>리더 위치 패널</span>
                  </div>
                  {selectedItem && <Badge className="bg-blue-600">{selectedItem.name} 선택됨</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="h-full">
                <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg p-6">
                  {locationPanels.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-gray-600">
                      아직 수신된 RTLS 위치 데이터가 없습니다.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 h-full">
                      {locationPanels.map((location) => (
                        <div key={location} className="bg-white rounded-lg p-4 shadow-md border-2 border-gray-300">
                          <div className="text-center font-bold text-lg mb-4 text-gray-700">{location}</div>
                          <div className="space-y-2 max-h-[560px] overflow-y-auto">
                            {filteredEquipment
                              .filter((eq) => eq.location === location)
                              .map((eq) => (
                                <div
                                  key={eq.id}
                                  className={`p-2 rounded-md text-xs flex items-center justify-between gap-2 transition-all ${
                                    selectedEquipment === eq.id
                                      ? 'bg-blue-500 text-white shadow-lg scale-[1.01]'
                                      : 'bg-gray-100 text-gray-700'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className={`w-2 h-2 rounded-full ${getStatusColor(eq.isStale)}`} />
                                    <span className="truncate">{eq.name}</span>
                                  </div>
                                  <span className="text-[10px] opacity-80">{eq.rssi ?? '-'}</span>
                                </div>
                              ))}

                            {filteredEquipment.filter((eq) => eq.location === location).length === 0 && (
                              <div className="text-xs text-gray-400 text-center py-2">현재 태그 없음</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
