import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { HelmetProvider } from '@dr.pogodin/react-helmet';

import AddProviderForm from './components/AddProviderForm';
import AddOfferForm from './components/AddOfferForm';
import EditOfferForm from './components/EditOfferForm';
import ProviderDashboard from './components/ProviderDashboard';
import CookieNotice from './components/CookieNotice';
import Pitch from './pages/Pitch';
import Register from './pages/Register';
import Login from './pages/Login';
import LandingPage from './pages/LandingPage';
import AdminCategoryPage from './pages/AdminCategoryPage';
import AdminOffersMap from './pages/AdminOffersMap';
import EditProviderForm from './components/EditProviderForm';
import WhyStepsMatch from './pages/WhyStepsMatch';
import TesterGate from './pages/TesterGate';
import NDA from './pages/NDA';
import PrivacyPage from './pages/PrivacyPage';

function BootGuard() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  React.useLayoutEffect(() => {
    try {
      const key = localStorage.getItem('stepsmatch_tester_key');
      const accepted = localStorage.getItem('stepsmatch_ndaa_accepted') === '1';

      if (pathname === '/') {
        if (accepted) {
          navigate('/home', { replace: true });
          return;
        }
        if (key) {
          navigate('/nda', { replace: true });
        }
        return;
      }

      if (pathname === '/nda') {
        if (!key) {
          navigate('/', { replace: true });
          return;
        }
        if (accepted) {
          navigate('/home', { replace: true });
        }
        return;
      }

      if (!key) {
        navigate('/', { replace: true });
        return;
      }

      if (!accepted) {
        navigate('/nda', { replace: true });
      }
    } catch (e) {
      void e;
    }
  }, [navigate, pathname]);

  return null;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pathname]);
  return null;
}

const AppRoutes = () => {
  const handleLogin = (providerId) => {
    localStorage.setItem('providerId', providerId);
  };

  return (
    <>
      <BootGuard />
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<TesterGate />} />
        <Route path="/nda" element={<NDA />} />

        <Route path="/home" element={<LandingPage />} />
        <Route path="/why" element={<WhyStepsMatch />} />
        <Route path="/pitch" element={<Pitch />} />
        <Route path="/privacy" element={<PrivacyPage />} />

        <Route path="/register" element={<Register onRegisterSuccess={handleLogin} />} />
        <Route path="/login" element={<Login onLoginSuccess={handleLogin} />} />
        <Route path="/add-provider" element={<AddProviderForm />} />
        <Route path="/add-offer/:providerId" element={<AddOfferForm />} />
        <Route path="/edit-offer/:offerId" element={<EditOfferForm />} />
        <Route path="/dashboard/:providerId" element={<ProviderDashboard />} />
        <Route path="/admin/categories" element={<AdminCategoryPage />} />
        <Route path="/admin/offers" element={<AdminOffersMap />} />
        <Route path="/edit-provider/:providerId" element={<EditProviderForm />} />
        <Route path="/edit-provider" element={<EditProviderForm />} />

        <Route path="*" element={<p className="p-8 text-center text-red-500">404 - Seite nicht gefunden</p>} />
      </Routes>
    </>
  );
};

const App = () => {
  return (
    <HelmetProvider>
      <Router>
        <AppRoutes />
        <CookieNotice />
      </Router>
    </HelmetProvider>
  );
};

export default App;
