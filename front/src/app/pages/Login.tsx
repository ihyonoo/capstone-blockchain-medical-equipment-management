import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Lock, Mail } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('로그인 시도:', { email, password });
    // 로그인 성공 시 장비 검색 페이지로 이동
    navigate('/equipment');
  };

  const handleSignUp = () => {
    console.log('회원가입 페이지로 이동');
    // 회원가입 페이지 로직을 여기에 추가하세요
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-[768px] mx-auto">
        <Card className="w-full shadow-2xl">
          <CardHeader className="space-y-1 text-center pb-8">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                <Lock className="w-8 h-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-3xl">블록체인 기반 의료 장비 관리 시스템</CardTitle>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-base">이메일</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="example@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-12 text-base"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-base">비밀번호</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 h-12 text-base"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-600">로그인 상태 유지</span>
                </label>
                <a href="#" className="text-sm text-blue-600 hover:text-blue-800 hover:underline">
                  비밀번호 찾기
                </a>
              </div>

              <Button type="submit" className="w-full h-12 text-base bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700">
                로그인
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4 pt-6">
            <div className="relative w-full">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-500">또는</span>
              </div>
            </div>

            <Button 
              type="button" 
              variant="outline" 
              className="w-full h-12 text-base border-2 hover:bg-gray-50"
              onClick={handleSignUp}
            >
              회원가입
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
