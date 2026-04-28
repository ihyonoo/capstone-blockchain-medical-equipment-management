import { createBrowserRouter } from 'react-router';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import EquipmentSearch from './pages/EquipmentSearch';
import IntegrityVerification from './pages/IntegrityVerification';
import NfcMapping from './pages/NfcMapping';
import NfcEquipment from './pages/NfcEquipment';

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
    path: '/equipment',
    Component: EquipmentSearch,
  },
  {
    path: '/verification',
    Component: IntegrityVerification,
  },
  {
    path: '/admin/nfc-mapping',
    Component: NfcMapping,
  },
  {
    path: '/nfc/:token',
    Component: NfcEquipment,
  },
]);
