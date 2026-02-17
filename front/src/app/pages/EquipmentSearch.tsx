import { useState, useMemo } from "react";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
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
  Shield
} from "lucide-react";
import { useNavigate } from "react-router";

// Mock 데이터: 실제로는 RTLS 시스템에서 가져올 데이터
const mockEquipment = [
  {
    id: "ECG-001",
    name: "심전도 모니터",
    type: "모니터링",
    location: "진단검사실",
    department: "진단검사실",
    status: "사용중",
    lastUpdate: "2분 전",
    battery: 85,
  },
  {
    id: "VEN-102",
    name: "인공호흡기",
    type: "치료",
    location: "내과",
    department: "내과",
    status: "사용중",
    lastUpdate: "1분 전",
    battery: 92,
  },
  {
    id: "DEF-203",
    name: "제세동기",
    type: "응급",
    location: "진료과",
    department: "진료과",
    status: "대기",
    lastUpdate: "5분 전",
    battery: 100,
  },
  {
    id: "INF-304",
    name: "수액펌프",
    type: "치료",
    location: "내과",
    department: "내과",
    status: "사용중",
    lastUpdate: "3분 전",
    battery: 67,
  },
  {
    id: "MON-405",
    name: "환자 모니터",
    type: "모니터링",
    location: "응급실",
    department: "응급실",
    status: "사용중",
    lastUpdate: "1분 전",
    battery: 88,
  },
  {
    id: "BED-506",
    name: "전동침대",
    type: "병실",
    location: "내과",
    department: "내과",
    status: "사용중",
    lastUpdate: "10분 전",
    battery: 45,
  },
  {
    id: "TEMP-607",
    name: "체온계",
    type: "측정",
    location: "응급실",
    department: "응급실",
    status: "대기",
    lastUpdate: "2분 전",
    battery: 78,
  },
  {
    id: "XRA-708",
    name: "이동식 X-Ray",
    type: "영상",
    location: "영상의학과",
    department: "영상의학과",
    status: "대기",
    lastUpdate: "15분 전",
    battery: 95,
  },
  {
    id: "ULT-809",
    name: "초음파기",
    type: "영상",
    location: "영상의학과",
    department: "영상의학과",
    status: "사용중",
    lastUpdate: "7분 전",
    battery: 82,
  },
  {
    id: "STE-910",
    name: "청진기",
    type: "측정",
    location: "응급실",
    department: "응급실",
    status: "대기",
    lastUpdate: "20분 전",
    battery: 100,
  },
];

const equipmentTypes = [
  "전체",
  "모니터링",
  "치료",
  "응급",
  "병실",
  "측정",
  "영상",
];
const departments = [
  "전체",
  "진단검사실",
  "내과",
  "영상의학과",
  "진료과",
  "응급실",
];

const getEquipmentIcon = (type: string) => {
  switch (type) {
    case "모니터링":
      return <Activity className="w-5 h-5" />;
    case "치료":
      return <Heart className="w-5 h-5" />;
    case "응급":
      return <ScanLine className="w-5 h-5" />;
    case "병실":
      return <BedDouble className="w-5 h-5" />;
    case "측정":
      return <Thermometer className="w-5 h-5" />;
    case "영상":
      return <Stethoscope className="w-5 h-5" />;
    default:
      return <Activity className="w-5 h-5" />;
  }
};

const getStatusColor = (status: string) => {
  return status === "사용중" ? "bg-red-500" : "bg-green-500";
};

const getBatteryColor = (battery: number) => {
  if (battery > 70) return "text-green-600";
  if (battery > 30) return "text-yellow-600";
  return "text-red-600";
};

export default function EquipmentSearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("전체");
  const [selectedDepartment, setSelectedDepartment] =
    useState("전체");
  const [selectedEquipment, setSelectedEquipment] = useState<
    string | null
  >(null);
  const navigate = useNavigate();

  const filteredEquipment = useMemo(() => {
    return mockEquipment.filter((item) => {
      const matchesSearch =
        item.name
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        item.id
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        item.location
          .toLowerCase()
          .includes(searchQuery.toLowerCase());
      const matchesType =
        selectedType === "전체" || item.type === selectedType;
      const matchesDepartment =
        selectedDepartment === "전체" ||
        item.department.includes(selectedDepartment);
      return matchesSearch && matchesType && matchesDepartment;
    });
  }, [searchQuery, selectedType, selectedDepartment]);

  const handleLogout = () => {
    navigate("/");
  };

  const handleGoToVerification = () => {
    navigate("/verification");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-md border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <MapPin className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  블록체인 기반 의료 장비 관리 시스템
                </h1>
                <p className="text-sm text-gray-600">
                  의료 장비 실시간 위치 추적
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                onClick={handleGoToVerification}
                className="flex items-center space-x-2"
              >
                <Shield className="w-4 h-4" />
                <span>무결성 검증</span>
              </Button>
              <Button
                variant="outline"
                onClick={handleLogout}
                className="flex items-center space-x-2"
              >
                <LogOut className="w-4 h-4" />
                <span>로그아웃</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Search and Filters */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Search className="w-5 h-5" />
                  <span>장비 검색</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    placeholder="장비명 또는 ID 검색..."
                    value={searchQuery}
                    onChange={(e) =>
                      setSearchQuery(e.target.value)
                    }
                    className="pl-10"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    장비 유형
                  </label>
                  <Select
                    value={selectedType}
                    onValueChange={setSelectedType}
                  >
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
                  <label className="text-sm font-medium">
                    부서별 검색
                  </label>
                  <Select
                    value={selectedDepartment}
                    onValueChange={setSelectedDepartment}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="부서 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((department) => (
                        <SelectItem
                          key={department}
                          value={department}
                        >
                          {department}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                      검색 결과
                    </span>
                    <span className="font-semibold text-blue-600">
                      {filteredEquipment.length}개 장비
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Equipment List */}
            <Card>
              <CardHeader>
                <CardTitle>장비 목록</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 max-h-[600px] overflow-y-auto">
                {filteredEquipment.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Search className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p>검색 결과가 없습니다</p>
                  </div>
                ) : (
                  filteredEquipment.map((item) => (
                    <div
                      key={item.id}
                      onClick={() =>
                        setSelectedEquipment(item.id)
                      }
                      className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                        selectedEquipment === item.id
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-blue-300"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                            {getEquipmentIcon(item.type)}
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900">
                              {item.name}
                            </h4>
                            <p className="text-xs text-gray-500">
                              {item.id}
                            </p>
                          </div>
                        </div>
                        <div
                          className={`w-2 h-2 rounded-full ${getStatusColor(item.status)} mt-2`}
                        />
                      </div>

                      <div className="space-y-1 text-sm">
                        <div className="flex items-center space-x-2 text-gray-600">
                          <MapPin className="w-4 h-4" />
                          <span>{item.location}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <Badge
                            variant="secondary"
                            className="text-xs"
                          >
                            {item.type}
                          </Badge>
                          <span
                            className={`text-xs font-medium ${getBatteryColor(item.battery)}`}
                          >
                            🔋 {item.battery}%
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">
                          업데이트: {item.lastUpdate}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - Map/Floor Plan */}
          <div className="lg:col-span-2">
            <Card className="h-full min-h-[800px]">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Navigation className="w-5 h-5" />
                    <span>병원 평면도</span>
                  </div>
                  {selectedEquipment && (
                    <Badge className="bg-blue-600">
                      {
                        filteredEquipment.find(
                          (e) => e.id === selectedEquipment,
                        )?.name
                      }{" "}
                      선택됨
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="h-full">
                {/* 실제 구현에서는 여기에 실제 평면도나 지도 컴포넌트가 들어갑니다 */}
                <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center relative overflow-hidden">
                  {/* 간단한 평면도 시뮬레이션 */}
                  <div className="absolute inset-0 p-8">
                    <div className="grid grid-cols-3 gap-4 h-full">
                      {[
                        "진단검사실",
                        "내과",
                        "영상의학과",
                        "진료과",
                        "응급실",
                      ].map((dept) => (
                        <div
                          key={dept}
                          className="bg-white rounded-lg p-4 shadow-md border-2 border-gray-300"
                        >
                          <div className="text-center font-bold text-lg mb-4 text-gray-700">
                            {dept}
                          </div>
                          <div className="space-y-2">
                            {filteredEquipment
                              .filter(
                                (eq) => eq.department === dept,
                              )
                              .map((eq) => (
                                <div
                                  key={eq.id}
                                  className={`p-2 rounded-md text-xs flex items-center space-x-2 transition-all ${
                                    selectedEquipment === eq.id
                                      ? "bg-blue-500 text-white shadow-lg scale-105"
                                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                  }`}
                                >
                                  <div
                                    className={`w-2 h-2 rounded-full ${getStatusColor(eq.status)}`}
                                  />
                                  <span className="truncate">
                                    {eq.name}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {!selectedEquipment && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-10 backdrop-blur-sm">
                      <div className="text-center bg-white rounded-lg p-8 shadow-xl">
                        <MapPin className="w-16 h-16 mx-auto mb-4 text-blue-500" />
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">
                          장비를 선택하세요
                        </h3>
                        <p className="text-gray-600">
                          왼쪽 목록에서 장비를 선택하면
                          <br />
                          평면도에서 위치를 확인할 수 있습니다
                        </p>
                      </div>
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