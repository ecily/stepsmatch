// frontend/src/pages/LandingPage.jsx
import React from "react";
import { Link } from "react-router-dom";
import logo from "../assets/logo.png";       // ✅ PNG-Logo
import heroBg from "../assets/hero-bg.jpg";  // ✅ Hero-Hintergrundbild

const LandingPage = () => {
  return (
    <div className="bg-white min-h-screen flex flex-col">
      {/* Hero Section mit Hintergrundbild */}
      <header
        className="text-white py-20 bg-cover bg-center relative"
        style={{
          backgroundImage: `url(${heroBg})`,
        }}
      >
        <div className="absolute inset-0 bg-blue-800 bg-opacity-50"></div> {/* Overlay für Lesbarkeit */}
        <div className="relative max-w-4xl mx-auto px-6 text-center z-10">
          <img
            src={logo}
            alt="StepsMatch Logo"
            className="w-40 h-40 mx-auto mb-6"
          />

          <h1 className="text-4xl md:text-5xl font-extrabold mb-4">
            Finden. Nicht suchen.
          </h1>
          <p className="text-lg md:text-xl mb-6">
            Deine Umgebung, deine Bedürfnisse – stepsmatch zeigt dir, was du brauchst, genau dann, wenn du es brauchst.
          </p>
          <Link
            to="/login"
            className="inline-block bg-white text-blue-600 font-semibold px-6 py-3 rounded-lg hover:bg-gray-100"
          >
            Anbieter-Login
          </Link>
        </div>
      </header>

      {/* Features */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-5xl mx-auto px-6 grid md:grid-cols-3 gap-8 text-center">
          <div>
            <h3 className="text-xl font-semibold text-blue-600 mb-2">Ortsspezifisch</h3>
            <p className="text-gray-600">
              Angebote werden automatisch in deiner Nähe angezeigt – kein Tippen, kein Suchen.
            </p>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-blue-600 mb-2">Echtzeit</h3>
            <p className="text-gray-600">
              Unsere App prüft in Echtzeit, welche Anbieter für dich gerade relevant sind.
            </p>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-blue-600 mb-2">Einfach</h3>
            <p className="text-gray-600">
              Kein Suchen, keine Werbung. Nur das, was du brauchst – genau dann, wenn du es brauchst.
            </p>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">Du möchtest dein Angebot sichtbar machen?</h2>
          <p className="text-gray-700 mb-6">
            Registriere dich kostenlos als Anbieter und erreiche Menschen genau im richtigen Moment.
          </p>
          <Link
            to="/register"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
          >
            Jetzt registrieren
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto bg-gray-100 py-6 text-center text-sm text-gray-600">
        &copy; {new Date().getFullYear()} stepsmatch.com – Kein Suchen. Nur Finden.
      </footer>
    </div>
  );
};

export default LandingPage;
