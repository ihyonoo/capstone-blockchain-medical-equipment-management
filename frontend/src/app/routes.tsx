import { createBrowserRouter } from 'react-router';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import SignUpComplete from './pages/SignUpComplete';
import FindId from './pages/FindId';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';
import AuthCallback from './pages/AuthCallback';
import MyPage from './pages/MyPage';
import EquipmentSearch from './pages/EquipmentSearch';
import IntegrityVerification from './pages/IntegrityVerification';
import NfcMapping from './pages/NfcMapping';
import NfcEquipment from './pages/NfcEquipment';
import DeviceStatus from './pages/DeviceStatus';
import AiReport from './pages/AiReport';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Login,
  },
  {
    path: '/signup',
    Component: SignUp,
  },
  {
    path: '/signup/complete',
    Component: SignUpComplete,
  },
  {
    path: '/find-id',
    Component: FindId,
  },
  {
    path: '/forgot-password',
    Component: ForgotPassword,
  },
  {
    path: '/reset-password',
    Component: ResetPassword,
  },
  {
    path: '/verify-email',
    Component: VerifyEmail,
  },
  {
    path: '/auth/callback',
    Component: AuthCallback,
  },
  {
    path: '/me',
    Component: MyPage,
  },
  {
    path: '/equipment',
    Component: EquipmentSearch,
  },
  {
    path: '/verification',
    Component: IntegrityVerification,
  },
  {
    path: '/admin/devices',
    Component: DeviceStatus,
  },
  {
    path: '/admin/nfc-mapping',
    Component: NfcMapping,
  },
  {
    path: '/admin/ai-report',
    Component: AiReport,
  },
  {
    path: '/nfc/:token',
    Component: NfcEquipment,
  },
]);
