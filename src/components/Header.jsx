import { NavLink } from 'react-router-dom';

export default function Header() {
  return (
    <header className="dashboard-header">
      <div className="header-content">
        <div className="header-top">
          <div>
            <h1>Shellfish Farm Outplant Dashboard</h1>
            <p className="subtitle">
              Multi-year <em>Crassostrea gigas</em> stress-hardening outplant
              monitoring across Puget Sound &amp; Willapa Bay farm sites and
              priming treatments
            </p>
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
