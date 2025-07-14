import React from "react";
import { Link } from "react-router-dom";
import logo from "../assets/logo.png";
import heroBg from "../assets/hero-bg.png";

const LandingPage = () => {
  return (
    <div className="bg-white min-h-screen flex flex-col font-sans text-gray-900">
      {/* Hero Section */}
      <header
        className="relative w-full h-screen bg-cover bg-center"
        style={{ backgroundImage: `url(${heroBg})` }}
      >
        <div className="absolute inset-0 bg-black bg-opacity-60" />
        <div className="relative z-10 flex flex-col items-center justify-center h-full px-6 text-center">
          <img
            src={logo}
            alt="StepsMatch Logo"
            className="w-40 h-40 md:w-64 md:h-64 mb-6 drop-shadow-xl"
          />
          <h1 className="text-3xl md:text-5xl font-extrabold text-white leading-snug mb-2 tracking-tight">
            stepsmatch.com
          </h1>
          <p className="text-xl md:text-2xl italic text-gray-200 mb-6">
            finden. nicht suchen.
          </p>
          <p className="text-md md:text-lg text-gray-300 max-w-xl mb-8">
            Deine Umgebung, deine Bedürfnisse – stepsmatch zeigt dir, was du brauchst, genau dann, wenn du es brauchst.
          </p>
          <Link
            to="/login"
            className="bg-white text-blue-700 font-semibold px-6 py-3 rounded-full shadow-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-300 transition"
          >
            Anbieter-Login
          </Link>
        </div>
      </header>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-3 gap-12 text-center">
          {[
            {
              icon: "📍",
              title: "Ortsspezifisch",
              text: "Angebote werden automatisch in deiner Nähe angezeigt – kein Tippen, kein Suchen.",
            },
            {
              icon: "⚡",
              title: "Echtzeit",
              text: "Unsere App prüft in Echtzeit, welche Anbieter für dich gerade relevant sind.",
            },
            {
              icon: "✅",
              title: "Einfach",
              text: "Kein Suchen, keine Werbung. Nur das, was du brauchst – genau dann, wenn du es brauchst.",
            },
          ].map((feature, i) => (
            <div key={i} className="p-4">
              <div className="text-4xl mb-3">{feature.icon}</div>
              <h3 className="text-xl font-semibold text-blue-700 mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-600">{feature.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Du möchtest dein Angebot sichtbar machen?
          </h2>
          <p className="text-gray-700 mb-6">
            Registriere dich kostenlos als Anbieter und erreiche Menschen genau im richtigen Moment.
          </p>
          <Link
            to="/register"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-full shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 transition"
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
