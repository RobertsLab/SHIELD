const researchThemes = [
  {
    title: 'Research Focus',
    label: 'Replace with study question or objective',
    body:
      'Describe the central research question, target species, field context, and why the dashboard measurements matter for shellfish production or ecological resilience.',
  },
  {
    title: 'Study Design',
    label: 'Replace with experimental design summary',
    body:
      'Summarize treatments, sites, time periods, sampling frequency, and the field or lab measurements used to compare outcomes.',
  },
  {
    title: 'Dashboard Data',
    label: 'Replace with data source notes',
    body:
      'Explain which observations are included here, how they were collected, and any important caveats about missing metrics, quality control, or interpretation.',
  },
];

const researcherRoles = [
  'Principal investigator',
  'Research scientist',
  'Graduate researcher',
  'Field and data contributors',
];

const fundingPlaceholders = [
  'Award or program name',
  'Funding agency',
  'Grant number',
  'Project period',
];

export default function ResearchPage() {
  return (
    <main className="dashboard-main research-page">
      <section className="card research-hero">
        <p className="research-kicker">Research Overview</p>
        <h2>Shellfish Stress-Hardening Field Research</h2>
        <p>
          Use this page to introduce the science behind SHIELD: what the team is
          testing, who is carrying out the work, and which funding sources make
          the research possible.
        </p>
      </section>

      <section className="research-grid">
        {researchThemes.map((theme) => (
          <article className="card research-topic" key={theme.title}>
            <p className="research-kicker">{theme.label}</p>
            <h3>{theme.title}</h3>
            <p>{theme.body}</p>
          </article>
        ))}
      </section>

      <section className="card research-section">
        <div className="research-section-header">
          <div>
            <p className="research-kicker">People</p>
            <h2 className="section-title">Researchers and Collaborators</h2>
          </div>
          <p className="chart-caption">
            Replace these template entries with names, affiliations, project
            roles, and links to lab or institutional profiles.
          </p>
        </div>

        <div className="researcher-list">
          {researcherRoles.map((role) => (
            <article className="researcher-item" key={role}>
              <div className="researcher-avatar" aria-hidden="true">
                {role.charAt(0)}
              </div>
              <div>
                <h3>[Researcher Name]</h3>
                <p className="researcher-role">{role}</p>
                <p>
                  Add a concise bio describing responsibilities, expertise, and
                  contribution to the project.
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="card research-section">
        <div className="research-section-header">
          <div>
            <p className="research-kicker">Support</p>
            <h2 className="section-title">Funding and Acknowledgments</h2>
          </div>
          <p className="chart-caption">
            Use this area for grant details, funder logos if appropriate, and
            required acknowledgment language.
          </p>
        </div>

        <dl className="funding-grid">
          {fundingPlaceholders.map((item) => (
            <div key={item}>
              <dt>{item}</dt>
              <dd>[To be provided]</dd>
            </div>
          ))}
        </dl>

        <div className="acknowledgment-box">
          <h3>Acknowledgment Template</h3>
          <p>
            This work was supported by [Funding Agency/Program] under award
            [Grant Number]. Add required disclaimer language and acknowledge
            partner farms, field teams, hatchery contributors, and data
            stewards.
          </p>
        </div>
      </section>
    </main>
  );
}
