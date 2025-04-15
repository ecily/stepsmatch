import React from 'react';
import { Link } from 'react-router-dom';

const LandingPage = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 to-green-100">
      <div className="bg-white shadow-xl rounded-xl p-8 max-w-lg w-full text-center">
        <h1 className="text-3xl font-bold mb-4 text-gray-800">Willkommen bei <span className="text-blue-600">stepsmatch</span></h1>
        <p className="text-gray-600 mb-6">Die Plattform für lokale Angebote, genau dann, wenn du sie brauchst.</p>

        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link
            to="/login"
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition"
          >
            Anbieter-Login
          </Link>
          <Link
            to="/register"
            className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 transition"
          >
            Jetzt registrieren
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;

