// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import AddProviderForm from './components/AddProviderForm';
import AddOfferForm from './components/AddOfferForm';
import EditOfferForm from './components/EditOfferForm';
import ProviderDashboard from './components/ProviderDashboard';

import Register from './pages/Register';
import Login from './pages/Login';
import LandingPage from './pages/LandingPage';
import AdminCategoryPage from './pages/AdminCategoryPage';
import AdminOffersMap from './pages/AdminOffersMap'; // ✅ korrekt

const App = () => {
  console.log('🌐 Aktive API Base URL:', import.meta.env.VITE_API_BASE_URL);

  const handleLogin = (providerId) => {
    localStorage.setItem('providerId', providerId);
  };

  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/register" element={<Register onRegisterSuccess={handleLogin} />} />
        <Route path="/login" element={<Login onLoginSuccess={handleLogin} />} />
        <Route path="/add-provider" element={<AddProviderForm />} />
        <Route path="/add-offer/:providerId" element={<AddOfferForm />} />
        <Route path="/edit-offer/:offerId" element={<EditOfferForm />} />
        <Route path="/dashboard/:providerId" element={<ProviderDashboard />} />
        <Route path="/admin/categories" element={<AdminCategoryPage />} />
        <Route path="/admin/offers" element={<AdminOffersMap />} />
        <Route path="*" element={<p className="p-8 text-center text-red-500">404 – Seite nicht gefunden</p>} />
      </Routes>
    </Router>
  );
};

console.log('🌍 VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL);

export default App;
