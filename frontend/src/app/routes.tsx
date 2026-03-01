import { createBrowserRouter } from 'react-router';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import EquipmentSearch from './pages/EquipmentSearch';
import IntegrityVerification from './pages/IntegrityVerification';

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
]);
