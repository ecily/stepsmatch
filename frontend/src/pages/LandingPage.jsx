// frontend/src/pages/LandingPage.jsx
import React from "react";
import { Link } from "react-router-dom";
import logo from "../assets/logo.png";
import heroBg from "../assets/hero-bg.jpg";

const LandingPage = () => {
  return (
    <div className="bg-white min-h-screen flex flex-col font-sans">
      {/* Hero Section */}
      <header
        className="relative bg-cover bg-center text-white"
        style={{ backgroundImage: `url(${heroBg})` }}
      >
        <div className="absolute inset-0 bg-black bg-opacity-70"></div> {/* Erhöhte Opazität für das Hintergrundbild */}
        <div className="relative z-10 max-w-4xl mx-auto px-6 py-12 text-center"> {/* Noch kleinere Hero Section */}
          <img
            src={logo}
            alt="StepsMatch Logo"
            className="w-72 h-72 mx-auto mb-4"  // Logo noch kleiner (288x288px)
          />
          <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-2"> {/* Kleinere Schriftgröße */}
            <span className="block text-3xl font-semibold text-gray-100 mb-2">stepsmatch.com</span>
            Finden. Nicht suchen.
          </h1>
          <p className="text-md md:text-lg mb-4 text-gray-200"> {/* Kleinere Beschreibung */}
            Deine Umgebung, deine Bedürfnisse – stepsmatch zeigt dir, was du brauchst, genau dann, wenn du es brauchst.
          </p>
          <Link
            to="/login"
            className="inline-block bg-white text-blue-700 font-semibold px-6 py-3 rounded-lg shadow hover:bg-gray-100 transition duration-200"
          >
            Anbieter-Login
          </Link>
        </div>
      </header>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-3 gap-10 text-center">
          <div>
            <div className="text-blue-600 text-3xl mb-2">📍</div>
            <h3 className="text-xl font-semibold text-blue-700 mb-2">Ortsspezifisch</h3>
            <p className="text-gray-600">
              Angebote werden automatisch in deiner Nähe angezeigt – kein Tippen, kein Suchen.
            </p>
          </div>
          <div>
            <div className="text-blue-600 text-3xl mb-2">⚡</div>
            <h3 className="text-xl font-semibold text-blue-700 mb-2">Echtzeit</h3>
            <p className="text-gray-600">
              Unsere App prüft in Echtzeit, welche Anbieter für dich gerade relevant sind.
            </p>
          </div>
          <div>
            <div className="text-blue-600 text-3xl mb-2">✅</div>
            <h3 className="text-xl font-semibold text-blue-700 mb-2">Einfach</h3>
            <p className="text-gray-600">
              Kein Suchen, keine Werbung. Nur das, was du brauchst – genau dann, wenn du es brauchst.
            </p>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">Du möchtest dein Angebot sichtbar machen?</h2>
          <p className="text-gray-700 mb-6">
            Registriere dich kostenlos als Anbieter und erreiche Menschen genau im richtigen Moment.
          </p>
          <Link
            to="/register"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg shadow hover:bg-blue-700 transition duration-200"
          >
            Jetzt registrieren
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto bg-gray-100 py-6 text-center text-sm text-gray-600">
        &copy; {new Date().getFullYear()} stepsmatch.com – ein Projekt von ecily/Webentwicklung
      </footer>
    </div>
  );
};

export default LandingPage;
