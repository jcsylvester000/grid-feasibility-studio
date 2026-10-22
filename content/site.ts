/**
 * All public-page copy (BRD P-01: "Copy is managed in a single content file so marketing can edit it
 * without touching components"). Edit text here; the pages read from this file only.
 * Items marked GRID-DECISION need GRID's confirmation before launch.
 */

export const site = {
  name: "GRID Feasibility Studio",
  owner: "GRID Property Ventures",
  tagline: "Sourced property feasibility, in minutes.",
  description:
    "Sourced feasibility reports for Philippine property: a quick price screen, a one-page executive summary or a full feasibility study, with every figure dated and cited.",
  disclaimer:
    "Reports are research to support decisions. They are not a licensed appraisal, or engineering, legal, tax or financial advice.",
  supportLine: "GRID support",
};

export const nav = [
  { href: "/feasibility-study", label: "What is a feasibility study" },
  { href: "/how-it-works", label: "How it works" },
];

export type ProductCard = {
  key: "quick_report" | "executive_summary" | "feasibility_report" | "teaser_intake";
  name: string;
  line: string;
  needs: string;
  flag?: "teaser";
};

export const products: ProductCard[] = [
  {
    key: "quick_report",
    name: "Quick Report",
    line: "A fast price screen: is the asking price inside, below or above comparable listings?",
    needs: "Dropdowns only",
  },
  {
    key: "executive_summary",
    name: "Executive Summary",
    line: "One sourced page for a client: market, site, risks, key figures and next steps.",
    needs: "A few facts and any documents you have",
  },
  {
    key: "feasibility_report",
    name: "Feasibility Report",
    line: "The full study: market, site, legal and permits, financials, risks and a verdict.",
    needs: "The full set of inputs, including costs and funding",
  },
  {
    key: "teaser_intake",
    name: "Teaser Scan",
    line: "Start from a teaser, fact sheet or post. We read it, check its claims and fill the Quick Report for you.",
    needs: "A teaser file or pasted post",
    flag: "teaser",
  },
];

export const home = {
  eyebrow: "GRID Feasibility Studio",
  headline: "Know if a property deal works before you commit.",
  sub: "Sourced feasibility reports for Philippine property, in minutes instead of days. Every figure dated and cited.",
  primaryCta: { href: "/register", label: "Start free" },
  secondaryCta: { href: "/how-it-works", label: "How it works" },
  productsTitle: "Choose the report you need",
  why: [
    {
      title: "Sourced figures with dates",
      body: "Every number shows where it came from and when. Gaps are listed as limitations, never filled with guesses.",
    },
    {
      title: "Built for the Philippine market",
      body: "Peso figures, BIR zonal values, local comparables, title and tax declaration checks, and Philippine hazard data.",
    },
    {
      title: "Minutes instead of days",
      body: "Answer a few questions or upload a teaser, press Generate, and read the report while you wait.",
    },
  ],
  closingTitle: "Run your first report",
  closingBody: "Create an account with a username and password. No email needed.",
};

/** Sample card on Home. Values come from the C6 Calzada–Tipas mock Quick Report (Lamudi listing, 19 Oct 2026). */
export const sampleReport = {
  label: "Sample",
  product: "Quick Report",
  title: "C6 Road commercial lot, Calzada–Tipas, Taguig",
  rating: "Marginal",
  ratingNote: "Fairly priced",
  askingPerSqm: 42000,
  compLow: 30000,
  compHigh: 50000,
  lotAreaSqm: 14323,
  asOf: "19 Oct 2026",
  footnote: "Asking prices from listings, not closed sales. Mock report for illustration.",
};

export const feasibilityStudy = {
  title: "What is a feasibility study?",
  intro:
    "A feasibility study checks whether a property project can work before money is committed. It looks at the market, the site, the rules and the money, then says what could go wrong and what to do next.",
  blocks: [
    {
      icon: "market",
      title: "Market",
      body: "Who will buy or rent, and at what price? We compare asking prices and rents for similar properties nearby, note how recent they are, and show the range rather than a single number.",
    },
    {
      icon: "site",
      title: "Site and technical",
      body: "Can the site carry the project? Access, lot size and shape, utilities, and hazards such as flooding, faults and landslides, using public hazard maps and any surveys you provide.",
    },
    {
      icon: "legal",
      title: "Legal and regulatory",
      body: "Is the property clean and allowed for the use? Title and tax declaration, zoning, permits and clearances, with what still needs a certified copy or an official check.",
    },
    {
      icon: "financial",
      title: "Financial",
      body: "Do the numbers work? Land and building costs, revenue from sale or lease, funding, and returns such as IRR, NPV and payback, computed from your figures, never invented.",
    },
    {
      icon: "risks",
      title: "Risks and next steps",
      body: "What could change the answer? The main risks, how sensitive the result is to price and cost, the limits of the evidence, and the next documents or checks to get.",
    },
  ],
  whichTitle: "Which GRID report do I need?",
  which: [
    { need: "A fast check of an asking price", product: "Quick Report", what: "Price screen against comparable listings" },
    { need: "One page for a client or a decision", product: "Executive Summary", what: "Sourced one-page summary" },
    { need: "A full study before committing money", product: "Feasibility Report", what: "Full study with financials and a verdict" },
    { need: "You have a teaser, fact sheet or post", product: "Teaser Scan", what: "Reads it, checks claims, fills the Quick Report", flag: "teaser" },
  ],
};

export const howItWorks = {
  title: "How it works",
  intro: "Four steps from a question to a sourced report.",
  steps: [
    { title: "Create an account", body: "Choose a username and a password. No email needed. Save the recovery key we show you once." },
    {
      title: "Choose a report",
      body: "Pick Quick Report, Executive Summary or Feasibility Report and answer the questions, or upload a teaser.",
    },
    {
      title: "Press Generate and wait",
      body: "The page shows progress. You can leave and come back; the report keeps running.",
    },
    { title: "Read, print or save", body: "Read the report on screen, then print it or save it as a PDF from your browser." },
  ],
  faq: [
    {
      q: "How long does a report take?",
      a: "A Quick Report usually takes a few minutes. A full Feasibility Report takes longer because more research and checks run. The dashboard shows the typical time for each report.",
    },
    {
      q: "Where do the figures come from?",
      a: "From public sources such as property listings, BIR zonal values, census data and hazard maps, plus the facts and documents you provide. Each figure shows its source and date.",
    },
    {
      q: "Are my files private?",
      a: "Yes. Files are stored privately and only you can open them. GRID staff see usage counts by anonymous User ID, never your file names, inputs or reports.",
    },
    {
      q: "What if I lose my password?",
      a: "Use your recovery key on the Reset password page. If you lost the key too, contact GRID support with your User ID.",
    },
    {
      q: "What does it cost?",
      // GRID-DECISION (open question Q-05): replace with the confirmed pricing text.
      a: "GRID will confirm pricing before launch. Ask GRID support for the current terms.",
    },
  ],
};

export const legal = {
  termsVersion: "2026-10-22",
  privacyVersion: "2026-10-22",
  draftNotice: "Draft for legal review. Not yet approved by GRID's counsel.",
};
