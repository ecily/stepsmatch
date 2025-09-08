// frontend/src/components/AdminNav.jsx
import React from "react";
import { NavLink, Link } from "react-router-dom";

export default function AdminNav() {
  const base =
    "px-3 py-2 rounded-md text-sm font-medium transition-colors";
  const active =
    "text-gray-900 bg-gray-100";
  const idle =
    "text-gray-600 hover:text-gray-900 hover:bg-gray-50";

  return (
    <div className="sticky top-14 z-30 bg-white/80 backdrop-blur border-b border-gray-200/60">
      <div className="max-w-7xl mx-auto px-6 h-12 flex items-center justify-between">
        {/* Links: Admin-Menü */}
        <nav className="flex items-center gap-1">
          <NavLink
            to="/admin/categories"
            className={({ isActive }) => `${base} ${isActive ? active : idle}`}
          >
            Kategorien
          </NavLink>

          <NavLink
            to="/admin/offers"
            className={({ isActive }) => `${base} ${isActive ? active : idle}`}
          >
            Karte
          </NavLink>
        </nav>

        {/* Rechts: Zur Startseite (ohne Logout) */}
        <Link
          to="/home"
          className="px-3 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
          title="Zur Landing Page"
        >
          Zur&nbsp;Startseite
        </Link>
      </div>
    </div>
  );
}
