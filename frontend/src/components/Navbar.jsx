import React from "react";
import { Link } from "react-router-dom";

import { getPreferredSiteText } from "../content/siteContent";
import logoIcon from "../assets/stepsmatch-icon.svg";

export default function Navbar() {
  const text = React.useMemo(() => getPreferredSiteText(), []);

  return (
    <header className="sm-glass-nav">
      <div className="sm-shell flex h-20 items-center justify-between gap-3 py-2">
        <Link to="/" className="inline-flex items-center gap-3" aria-label="StepsMatch Startseite">
          <img src={logoIcon} alt="" aria-hidden="true" className="h-11 w-11 object-contain" />
          <span className="text-2xl font-extrabold tracking-tight text-blue-900 sm:text-[1.9rem]">
            {text.brand.name}
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <Link to="/register" className="sm-btn-secondary !hidden !px-4 !py-2 text-xs sm:!inline-flex sm:text-sm">
            Anbieter werden
          </Link>
          <Link to="/tester" className="sm-btn-primary !px-4 !py-2 text-xs sm:text-sm">
            App testen
          </Link>
        </div>
      </div>
    </header>
  );
}
