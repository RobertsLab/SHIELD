import { NavLink } from 'react-router-dom';
import logo from '../assets/logo.svg';

export default function Header() {
  return (
    <header className="dashboard-header">
      <div className="header-content">
        <div className="header-top">
          <div className="header-brand">
            <img
              className="header-logo"
              src={logo}
              alt="Roberts Lab logo"
            />
            <div>
              <h1>SHIELD</h1>
              <p className="subtitle">
                Shellfish Hardening and Integrated Environmental Longitudinal
                Dashboard
              </p>
              <p className="subtitle">
                Tracking how stress-hardening treatments perform across farms,
                years, and environments.
              </p>
            </div>
          </div>
          <nav className="header-nav" aria-label="Main navigation">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                isActive ? 'nav-link active' : 'nav-link'
              }
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/map"
              className={({ isActive }) =>
                isActive ? 'nav-link active' : 'nav-link'
              }
            >
              Site Map
            </NavLink>
            <NavLink
              to="/research"
              className={({ isActive }) =>
                isActive ? 'nav-link active' : 'nav-link'
              }
            >
              Research
            </NavLink>
          </nav>
        </div>
        <p className="disclaimer">
          Real field measurements: survival &amp; image-derived shell growth
          from RobertsLab outplant assessments (Goose Point, Sequim, Westcott)
          plus Baywater 10K-Seed survival; temperature is the in-situ HOBO
          logger monthly mean. Metrics not measured at an assessment are blank.
        </p>
      </div>
    </header>
  );
}
