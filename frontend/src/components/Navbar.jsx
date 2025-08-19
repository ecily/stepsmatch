import React from "react";
import { Link, NavLink } from "react-router-dom";
import icon from "../assets/stepsmatch-icon.svg";

export default function Navbar() {
  const baseLink =
    "px-3 py-2 rounded-md text-sm font-medium transition-colors";
  const active =
    "text-gray-900 bg-gray-100";
  const idle =
    "text-gray-600 hover:text-gray-900 hover:bg-gray-50";

  return (
    <div className="sticky top-0 z-40 backdrop-blur bg-white/70 border-b border-gray-200/60">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Left: Logo + Brand */}
        <Link to="/" className="flex items-center gap-3">
          <img src={icon} alt="StepsMatch" className="h-8 w-8 rounded-md" />
          <span className="text-lg font-semibold tracking-tight">
            Stepsmatch
          </span>
        </Link>

        {/* Center: Nav */}
        <nav className="hidden md:flex items-center gap-1">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `${baseLink} ${isActive ? active : idle}`
            }
            end
          >
            Start
          </NavLink>

          <NavLink
            to="/pitch"
            className={({ isActive }) =>
              `${baseLink} ${isActive ? active : idle}`
            }
          >
            Pitch
          </NavLink>

          <NavLink
            to="/admin/offers"
            className={({ isActive }) =>
              `${baseLink} ${isActive ? active : idle}`
            }
          >
            Admin Demo
          </NavLink>
        </nav>

        {/* Right: CTAs (optional / placeholder) */}
        <div className="flex items-center gap-2">
          <Link
            to="/login"
            className="hidden sm:inline-flex px-3 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
          >
            Login
          </Link>
          <Link
            to="/register"
            className="inline-flex px-3 py-2 text-sm rounded-md bg-gray-900 text-white hover:bg-gray-800 transition"
          >
            Loslegen
          </Link>
        </div>
      </div>
    </div>
  );
}
