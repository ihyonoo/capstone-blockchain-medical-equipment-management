import { createBrowserRouter } from 'react-router';
import Login from './pages/Login';
import EquipmentSearch from './pages/EquipmentSearch';
import IntegrityVerification from './pages/IntegrityVerification';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Login,
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