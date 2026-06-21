const researchThemes = [
  {
    title: 'Mass Mortality Risk',
    label: 'Objective 1',
    body:
      'Determine the susceptibility of Washington shellfish farms to heatwaves by monitoring air and water temperatures experienced by oysters during grow-out across Salish Sea and Willapa Bay farms.',
  },
  {
    title: 'Climate-Resilient Husbandry',
    label: 'Objective 2',
    body:
      'Develop a commercially viable hatchery protocol that improves oyster heat tolerance by testing stress-primed spat from OsHV-1 resistant Pacific oyster families in farm outplants.',
  },
  {
    title: 'Workforce Development',
    label: 'Objective 3',
    body:
      'Build an enhanced training curriculum for shellfish industry technicians, using OsHV-1 and heat waves as case studies with students from Bellingham Technical College.',
  },
];

const researchers = [
  {
    name: 'Ariana Huffmyer',
    role: 'Research lead',
    description:
      'Leads the research effort connecting oyster stress-hardening, field monitoring, and farm-scale climate resilience.',
  },
  {
    name: 'Steven Roberts',
    role: 'Research lead',
    description:
      'Co-leads the dashboard research and supports integration of field observations, environmental data, and project interpretation.',
  },
  {
    name: 'Emily Carrington',
    role: 'Washington Sea Grant award lead',
    description:
      'Leads the Washington Sea Grant collaborative partnership addressing oyster aquaculture mass mortalities through monitoring, husbandry, and workforce development.',
  },
  {
    name: 'Mackenzie Gavery',
    role: 'NOAA collaborator',
    description:
      'Collaborates on oyster resilience research connecting environmental conditioning, field performance, and shellfish aquaculture outcomes.',
  },
  {
    name: 'Grace Leauchtenberger',
    role: 'Graduate student researcher',
    description:
      'Graduate student contributing to the Washington Sea Grant project and associated research activities.',
  },
  {
    name: 'Matt George',
    role: 'Former postdoctoral researcher',
    description:
      'Helped launch the early stages of the oyster conditioning and field resilience research that informed the current project.',
  },
  {
    name: 'Megan Ewing',
    role: 'Incoming graduate student researcher',
    description:
      'Beginning in 2026, will expand related work with manila clams and basket cockles, including Manila clam field deployments at Agate Pass and Weavering Spit.',
  },
  {
    name: 'Jesse Lowe',
    role: 'Undergraduate researcher',
    description:
      'Undergraduate student assisting Megan Ewing with the upcoming clam and cockle field research.',
  },
];

const fundingAwards = [
  {
    agency: 'Washington Sea Grant',
    status: 'Active support',
    title:
      'A collaborative partnership to address mass mortalities in oyster aquaculture through improved field monitoring, husbandry practices, and workforce development',
    lead: 'Emily Carrington',
    summary:
      'This collaborative partnership aims to support sustainable expansion of oyster aquaculture in Washington State by reducing mass mortality events linked to OsHV-1 infection and extreme climate events. The work combines environmental monitoring, oyster mortality data, hatchery stress-priming trials, and workforce training.',
  },
  {
    agency: 'USDA',
    status: 'Recently completed award',
    title:
      'Improved climate resilience in oysters through optimization of hatchery-based environmental conditioning practices',
    lead: 'Steven Roberts',
    summary:
      'This work focused on improving oyster stock resilience by optimizing hatchery-based conditioning practices. Research tested early-life stage environmental conditioning and broodstock husbandry to evaluate developmental and transgenerational plasticity as routes to carry-over benefits during later grow-out.',
  },
  {
    agency: 'UW School of Aquatic and Fishery Sciences',
    status: 'Donaldson research support',
    title:
      'Donaldson Finfish and Shellfish Breeding and Culture: field testing thermal and immune stress priming in Manila clams',
    lead: 'Megan Ewing',
    summary:
      'This award supports Megan Ewing’s dissertation research on improving field performance and environmental resilience of Manila clams through thermal and immune stress priming. Manila clam seed will be conditioned in the laboratory at UW and outplanted to Agate Pass and Weavering Spit in June 2026, with retrievals designed to evaluate immediate, post-summer, and longer-term effects of priming.',
  },
];

export default function ResearchPage() {
  return (
    <main className="dashboard-main research-page">
      <section className="card research-hero">
        <p className="research-kicker">Research Overview</p>
        <h2>Shellfish Stress-Hardening Field Research</h2>
        <p>
          SHIELD supports collaborative research aimed at reducing the
          frequency and severity of oyster mass mortality events associated with
          OsHV-1 infection and extreme climate events, including marine and
          aerial heatwaves.
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
            The research is led by Ariana Huffmyer with Steven Roberts, with
            Washington Sea Grant project leadership from Emily Carrington and
            contributions from postdoctoral, graduate, and undergraduate
            researchers across oyster, clam, and cockle field studies.
          </p>
        </div>

        <div className="researcher-list">
          {researchers.map((researcher) => (
            <article className="researcher-item" key={researcher.name}>
              <div className="researcher-avatar" aria-hidden="true">
                {researcher.name
                  .split(' ')
                  .map((part) => part.charAt(0))
                  .join('')}
              </div>
              <div>
                <h3>{researcher.name}</h3>
                <p className="researcher-role">{researcher.role}</p>
                <p>{researcher.description}</p>
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
            This work is supported by Washington Sea Grant and builds on a
            recently completed USDA award focused on hatchery-based oyster
            conditioning for climate resilience. Megan Ewing’s related clam
            research is also supported through UW SAFS Donaldson research
            support.
          </p>
        </div>

        <div className="funding-award-list">
          {fundingAwards.map((award) => (
            <article className="funding-award" key={award.title}>
              <div className="funding-award-header">
                <div>
                  <p className="research-kicker">{award.status}</p>
                  <h3>{award.agency}</h3>
                </div>
              </div>
              <p className="funding-award-title">{award.title}</p>
              <dl className="funding-award-meta">
                <div>
                  <dt>Award lead</dt>
                  <dd>{award.lead}</dd>
                </div>
              </dl>
              <p>{award.summary}</p>
            </article>
          ))}
        </div>

        <div className="acknowledgment-box">
          <h3>Research Context</h3>
          <p>
            Together, these awards support a connected research program on
            oyster climate resilience, from conditioning larvae and broodstock
            in hatchery settings to evaluating survival and performance after
            deployment at commercial grow-out sites. New related work extends
            this conditioning framework to Manila clams and basket cockles,
            linking laboratory priming experiments with field performance at
            partner sites.
          </p>
        </div>
      </section>
    </main>
  );
}
