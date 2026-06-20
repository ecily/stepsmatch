import React from "react";
import { Link, NavLink } from "react-router-dom";

import { getPreferredSiteText } from "../content/siteContent";

export default function Navbar() {
  const text = React.useMemo(() => getPreferredSiteText(), []);

  return (
    <header className="sm-glass-nav">
      <div className="sm-shell flex h-20 items-center justify-between gap-3 py-2">
        <Link to="/" className="inline-flex items-center gap-3" aria-label="StepsMatch Startseite">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-900 text-sm font-extrabold text-white shadow-sm">
            SM
          </span>
          <span className="text-2xl font-extrabold tracking-tight text-blue-900 sm:text-[1.9rem]">
            {text.brand.name}
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          <NavLink to="/app" className={({ isActive }) => `sm-nav-link ${isActive ? "sm-nav-link-active" : ""}`}>App</NavLink>
          <NavLink to="/so-funktionierts" className={({ isActive }) => `sm-nav-link ${isActive ? "sm-nav-link-active" : ""}`}>So funktioniert es</NavLink>
          <NavLink to="/pre-alpha" className={({ isActive }) => `sm-nav-link ${isActive ? "sm-nav-link-active" : ""}`}>PRE ALPHA</NavLink>
          <NavLink to="/anbieter" className={({ isActive }) => `sm-nav-link ${isActive ? "sm-nav-link-active" : ""}`}>Anbieter</NavLink>
        </nav>

        <div className="flex items-center gap-2">
          <Link to="/register" className="sm-btn-secondary !hidden !px-4 !py-2 text-xs sm:!inline-flex sm:text-sm">
            Anbieter werden
          </Link>
          <Link to="/?apk=1" className="sm-btn-primary !px-4 !py-2 text-xs sm:text-sm">
            App testen
          </Link>
        </div>
      </div>
    </header>
  );
}
