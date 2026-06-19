import React from "react";
import { Link } from "react-router-dom";

import { getPreferredSiteText } from "../content/siteContent";

export default function SiteFooter() {
  const text = React.useMemo(() => getPreferredSiteText(), []);

  return (
    <footer className="sm-divider bg-white/70">
      <div className="sm-shell flex flex-col gap-4 py-8 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-800 text-xs font-extrabold text-white">
            SM
          </span>
          <p className="text-sm font-semibold text-slate-700">
            © {new Date().getFullYear()} {text.brand.name}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-700">
          {text.footer.links.map((link) => (
            <Link key={link.to} to={link.to} className="hover:text-blue-800">
              {link.label}
            </Link>
          ))}
          <Link to="/login" className="font-semibold text-blue-800 hover:text-blue-900">
            Anbieter Login
          </Link>
        </div>
      </div>
    </footer>
  );
}
