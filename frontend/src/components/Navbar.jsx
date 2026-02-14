import React from "react";
import { Link, NavLink } from "react-router-dom";
import icon from "../assets/stepsmatch-icon.svg";

export default function Navbar() {
  const baseLink = "px-3 py-2 rounded-lg text-sm font-medium transition-colors";
  const active = "text-sky-700 bg-sky-50";
  const idle = "text-slate-600 hover:text-slate-900 hover:bg-slate-50";

  return (
    <div className="sticky top-0 z-40 border-b border-sky-100/80 bg-white/90 backdrop-blur">
      <div className="sm-shell h-16 flex items-center justify-between">
        <Link to="/home" className="flex items-center gap-3">
          <img src={icon} alt="StepsMatch" className="h-8 w-8 rounded-md" />
          <span className="text-lg font-semibold tracking-tight text-slate-900">StepsMatch</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          <NavLink to="/home" className={({ isActive }) => `${baseLink} ${isActive ? active : idle}`}>
            Home
          </NavLink>
          <NavLink to="/why" className={({ isActive }) => `${baseLink} ${isActive ? active : idle}`}>
            Warum neu?
          </NavLink>
          <NavLink to="/pitch" className={({ isActive }) => `${baseLink} ${isActive ? active : idle}`}>
            Investoren
          </NavLink>
          <NavLink to="/admin/offers" className={({ isActive }) => `${baseLink} ${isActive ? active : idle}`}>
            Admin Demo
          </NavLink>
        </nav>

        <div className="flex items-center gap-2">
          <Link to="/login" className="hidden sm:inline-flex px-4 py-2 text-sm rounded-full border border-slate-200 text-slate-700 hover:bg-slate-50 transition">
            Login
          </Link>
          <Link to="/register" className="inline-flex px-4 py-2 text-sm rounded-full bg-sky-600 text-white hover:bg-sky-700 transition">
            Anbieter starten
          </Link>
        </div>
      </div>
    </div>
  );
}
