import { useMemo, useState } from 'react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  Search,
  Shield,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  User,
  Calendar,
  Hash,
  Database,
  Link2,
  ChevronDown,
  ChevronUp,
  LogOut,
  MapPin,
} from 'lucide-react';
import { useNavigate } from 'react-router';

type StaffRole = '간호사' | '의사';

type UsageHistoryItem = {
  id: string;
  equipmentId: string;
  equipmentName: string;

  user: {
    name: string;
    department: string;
    role: StaffRole;
  };

  rentedAt: string; // "YYYY-MM-DD HH:mm:ss"
  returnedAt: string | null; // 반납 전이면 null
  txIndex: number;

  calculatedHash: string;
  blockchainHash: string;
  verified: boolean;
};

// Mock 장비 사용 이력 데이터
const mockUsageHistory: UsageHistoryItem[] = [
  {
    id: 'USG-003',
    equipmentId: 'DEF-203',
    equipmentName: '제세동기',
    user: { name: '최현우', department: '내과', role: '간호사' },
    rentedAt: '2026-02-11 12:30:22',
    returnedAt: '2026-02-11 12:43:08',
    txIndex: 452193,
    calculatedHash: 'df2939a157d02ded4ba8457ec3508b425f445bd1369a7fbac774a543197d724a',
    blockchainHash: 'df2939a157d02ded4ba8457ec3508b425f445bd1369a7fbac774a543197d724a',
    verified: true,
  },
  {
    id: 'USG-004',
    equipmentId: 'XRA-708',
    equipmentName: '이동식 X-Ray',
    user: { name: '최기사', department: '영상의학과', role: '의사' },
    rentedAt: '2026-02-11 06:20:33',
    returnedAt: null,
    txIndex: 13,
    calculatedHash: 'd6e8f1a2b5c4d7e9f0d1c2b3a4f5e6d7',
    blockchainHash: 'd6e8f1a2b5c4d7e9f0d1c2b3a4f5e6d7',
    verified: true,
  },
  {
    id: 'USG-005',
    equipmentId: 'INF-304',
    equipmentName: '수액펌프',
    user: { name: '정간호사', department: '내과', role: '간호사' },
    rentedAt: '2026-02-10 21:50:45',
    returnedAt: '2026-02-10 23:50:45',
    txIndex: 14,
    calculatedHash: 'e7f9a2b3c6d5e8f0a1d2c3b4a5f6e7d8',
    blockchainHash: 'e7f9a2b3c6d5e8f0a1d2c3b4a5f6e7d8',
    verified: true,
  },
  {
    id: 'USG-006',
    equipmentId: 'ECG-001',
    equipmentName: '심전도 모니터',
    user: { name: '강의사', department: '진단검사실', role: '의사' },
    rentedAt: '2026-02-10 21:45:18',
    returnedAt: '2026-02-10 22:15:18',
    txIndex: 15,
    calculatedHash: 'f8a0b3c4d7e6f9a1b2d3c4b5a6f7e8d9',
    blockchainHash: 'MODIFIED_HASH_12345678910',
    verified: false,
  },
  {
    id: 'USG-007',
    equipmentId: 'ULT-809',
    equipmentName: '초음파기',
    user: { name: '송의사', department: '영상의학과', role: '의사' },
    rentedAt: '2026-02-10 20:30:55',
    returnedAt: null,
    txIndex: 16,
    calculatedHash: 'a9b1c4d5e8f7a0b2c3d4e5f6a7b8c9d0',
    blockchainHash: 'a9b1c4d5e8f7a0b2c3d4e5f6a7b8c9d0',
    verified: true,
  },
  {
    id: 'USG-008',
    equipmentId: 'MON-405',
    equipmentName: '환자 모니터',
    user: { name: '윤간호사', department: '진료과', role: '간호사' },
    rentedAt: '2026-02-10 18:45:12',
    returnedAt: null,
    txIndex: 17,
    calculatedHash: 'b0c2d5e6f9a8b1c3d4e5f6a7b8c9d0e1',
    blockchainHash: 'b0c2d5e6f9a8b1c3d4e5f6a7b8c9d0e1',
    verified: true,
  },
];

function makeDepartments(items: UsageHistoryItem[]) {
  const set = new Set<string>();
  for (const it of items) set.add(it.user.department);
  return ['전체', ...Array.from(set)];
}

const verificationStatus = ['전체', '검증 성공', '검증 실패'];

export default function IntegrityVerification() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('전체');
  const [selectedStatus, setSelectedStatus] = useState('전체');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);
  const navigate = useNavigate();

  const departments = useMemo(() => makeDepartments(mockUsageHistory), []);

  const filteredHistory = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return mockUsageHistory.filter((item) => {
      const userText = `${item.user.name} ${item.user.department} ${item.user.role}`.toLowerCase();

      const matchesSearch =
        q.length === 0 ||
        item.equipmentName.toLowerCase().includes(q) ||
        item.equipmentId.toLowerCase().includes(q) ||
        userText.includes(q);

      const matchesDepartment =
        selectedDepartment === '전체' || item.user.department === selectedDepartment;

      const matchesStatus =
        selectedStatus === '전체' ||
        (selectedStatus === '검증 성공' && item.verified) ||
        (selectedStatus === '검증 실패' && !item.verified);

      return matchesSearch && matchesDepartment && matchesStatus;
    });
  }, [searchQuery, selectedDepartment, selectedStatus]);

  const handleVerify = (id: string) => {
    setVerifying(id);
    setTimeout(() => {
      setVerifying(null);
    }, 1500);
  };

  const handleLogout = () => navigate('/');
  const handleGoToEquipment = () => navigate('/equipment');

  const verifiedCount = mockUsageHistory.filter((h) => h.verified).length;
  const totalCount = mockUsageHistory.length;
  const verificationRate = ((verifiedCount / totalCount) * 100).toFixed(1);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-md border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">블록체인 기반 의료 장비 관리 시스템</h1>
                <p className="text-sm text-gray-600">블록체인 기반 데이터 무결성 보장</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Button variant="outline" onClick={handleGoToEquipment} className="flex items-center space-x-2">
                <MapPin className="w-4 h-4" />
                <span>장비 검색</span>
              </Button>
              <Button variant="outline" onClick={handleLogout} className="flex items-center space-x-2">
                <LogOut className="w-4 h-4" />
                <span>로그아웃</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">전체 이력</p>
                  <p className="text-3xl font-bold text-gray-900">{totalCount}</p>
                </div>
                <Database className="w-10 h-10 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">검증 성공</p>
                  <p className="text-3xl font-bold text-green-600">{verifiedCount}</p>
                </div>
                <CheckCircle2 className="w-10 h-10 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">검증 실패</p>
                  <p className="text-3xl font-bold text-red-600">{totalCount - verifiedCount}</p>
                </div>
                <XCircle className="w-10 h-10 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">무결성 비율</p>
                  <p className="text-3xl font-bold text-indigo-600">{verificationRate}%</p>
                </div>
                <Shield className="w-10 h-10 text-indigo-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Search className="w-5 h-5" />
              <span>검색 및 필터</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  placeholder="장비명, ID, 사용자 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger>
                  <SelectValue placeholder="부서 선택" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="검증 상태" />
                </SelectTrigger>
                <SelectContent>
                  {verificationStatus.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* History Table */}
        <Card>
          <CardHeader>
            <CardTitle>장비 사용 이력</CardTitle>
            <CardDescription>
              총 {filteredHistory.length}개의 이력 | 블록체인과 데이터베이스 해시값 비교를 통한 무결성 검증
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="space-y-3">
              {filteredHistory.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Search className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg">검색 결과가 없습니다</p>
                </div>
              ) : (
                filteredHistory.map((item) => (
                  <div key={item.id} className="border rounded-lg overflow-hidden">
                    <div
                      className={`p-4 cursor-pointer transition-colors ${
                        expandedRow === item.id ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'
                      }`}
                      onClick={() => setExpandedRow(expandedRow === item.id ? null : item.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4 flex-1">
                          {/* Verification Status Icon */}
                          <div>
                            {item.verified ? (
                              <CheckCircle2 className="w-6 h-6 text-green-500" />
                            ) : (
                              <XCircle className="w-6 h-6 text-red-500" />
                            )}
                          </div>

                          {/* Equipment Info */}
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-1">
                              <h4 className="font-semibold text-gray-900">{item.equipmentName}</h4>
                              <Badge variant="outline" className="text-xs">
                                {item.equipmentId}
                              </Badge>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                              <span className="flex items-center space-x-1">
                                <User className="w-4 h-4" />
                                <span>
                                  {item.user.name} / {item.user.department} / {item.user.role}
                                </span>
                              </span>

                              <span className="flex items-center space-x-1">
                                <Calendar className="w-4 h-4" />
                                <span>{item.rentedAt}</span>
                              </span>

                              <span className="flex items-center space-x-1">
                                <Link2 className="w-4 h-4" />
                                <span>TxIndex: {item.txIndex}</span>
                              </span>
                            </div>
                          </div>

                          {/* Verification Badge */}
                          <div>
                            {item.verified ? (
                              <Badge className="bg-green-500 hover:bg-green-600">
                                <ShieldCheck className="w-3 h-3 mr-1" />
                                검증 성공
                              </Badge>
                            ) : (
                              <Badge className="bg-red-500 hover:bg-red-600">
                                <ShieldAlert className="w-3 h-3 mr-1" />
                                검증 실패
                              </Badge>
                            )}
                          </div>

                          {/* Expand Icon */}
                          <div>
                            {expandedRow === item.id ? (
                              <ChevronUp className="w-5 h-5 text-gray-400" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {expandedRow === item.id && (
                      <div className="border-t bg-gray-50 p-6">
                        {/* Original Data */}
                        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="flex items-center space-x-2 mb-3">
                            <Database className="w-5 h-5 text-blue-600" />
                            <h5 className="font-semibold text-gray-900">원본 데이터 (데이터베이스 저장)</h5>
                          </div>

                          <div className="bg-white p-4 rounded-lg border space-y-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                              <div>
                                <span className="font-medium text-gray-700">장비 ID:</span>
                                <span className="ml-2 text-gray-600">{item.equipmentId}</span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700">장비명:</span>
                                <span className="ml-2 text-gray-600">{item.equipmentName}</span>
                              </div>

                              <div>
                                <span className="font-medium text-gray-700">사용자:</span>
                                <span className="ml-2 text-gray-600">
                                  {item.user.name} / {item.user.department} / {item.user.role}
                                </span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700">사용 위치:</span>
                                <span className="ml-2 text-gray-600">{"응급실 → 진료과"}</span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700">대여 시각:</span>
                                <span className="ml-2 text-gray-600">{item.rentedAt}</span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700">반납 시각:</span>
                                <span className="ml-2 text-gray-600">{item.returnedAt}</span>
                              </div>

                              <div>
                                <span className="font-medium text-gray-700">트랜잭션 인덱스:</span>
                                <span className="ml-2 text-gray-600">{item.txIndex}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Hash Verification */}
                        <div className="mb-4">
                          <div className="flex items-center justify-center mb-4">
                            <div className="flex items-center space-x-2 text-sm text-gray-600 bg-white px-4 py-2 rounded-full border">
                              <span>원본 데이터</span>
                              <span>→</span>
                              <span className="font-semibold text-blue-600">SHA-256 해시 함수</span>
                              <span>→</span>
                              <span>계산된 해시값</span>
                              <span>⇄</span>
                              <span className="font-semibold text-purple-600">블록체인 해시값 비교</span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Calculated Hash from DB */}
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <Hash className="w-5 h-5 text-blue-500" />
                              <h5 className="font-semibold text-gray-900">계산된 해시 (원본 데이터)</h5>
                            </div>
                            <div className="bg-white p-3 rounded-lg border">
                              <code className="text-xs text-gray-700 break-all font-mono">{item.calculatedHash}</code>
                            </div>
                            <p className="text-xs text-gray-500">데이터베이스의 원본 데이터로부터 계산됨</p>
                          </div>

                          {/* Blockchain Hash */}
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <Link2 className="w-5 h-5 text-purple-500" />
                              <h5 className="font-semibold text-gray-900">블록체인 해시 (저장된 값)</h5>
                            </div>
                            <div
                              className={`p-3 rounded-lg border ${
                                item.verified ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                              }`}
                            >
                              <code className="text-xs text-gray-700 break-all font-mono">{item.blockchainHash}</code>
                            </div>
                            <p className="text-xs text-gray-500">블록체인에 영구적으로 저장된 해시값</p>
                          </div>
                        </div>

                        {/* Verification Result */}
                        <div
                          className={`mt-6 p-4 rounded-lg border-2 ${
                            item.verified ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            {item.verified ? (
                              <>
                                <CheckCircle2 className="w-8 h-8 text-green-600" />
                                <div className="flex-1">
                                  <h5 className="font-semibold text-green-900 text-lg">무결성 검증 성공</h5>
                                  <p className="text-sm text-green-700">
                                    계산된 해시값과 블록체인 해시값이 일치합니다. 이 데이터는 변조되지 않았습니다.
                                  </p>
                                </div>
                              </>
                            ) : (
                              <>
                                <XCircle className="w-8 h-8 text-red-600" />
                                <div className="flex-1">
                                  <h5 className="font-semibold text-red-900 text-lg">무결성 검증 실패</h5>
                                  <p className="text-sm text-red-700">
                                    계산된 해시값과 블록체인 해시값이 일치하지 않습니다. 데이터가 변조되었을 가능성이 있습니다.
                                  </p>
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Blockchain Info */}
                        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <Link2 className="w-5 h-5 text-indigo-500" />
                              <h5 className="font-semibold text-gray-900">블록체인 정보</h5>
                            </div>
                            <div className="bg-white p-3 rounded-lg border space-y-1">
                              <p className="text-sm text-gray-700">
                                <span className="font-medium">트랜잭션 인덱스:</span> {item.txIndex}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Verify Button */}
                        <div className="mt-6 flex justify-end">
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleVerify(item.id);
                            }}
                            disabled={verifying === item.id}
                            className="flex items-center space-x-2"
                          >
                            {verifying === item.id ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                <span>검증 중...</span>
                              </>
                            ) : (
                              <>
                                <Shield className="w-4 h-4" />
                                <span>다시 검증</span>
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
