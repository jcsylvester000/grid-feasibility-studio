/**
 * Design shortlist for approval (task B0-13). 21st.dev items are copied into components/ui with the
 * shadcn CLI and restyled with GRID tokens. HorizonX needs a paid membership, so it is used as a
 * visual reference unless GRID provides exported files.
 */
export type ShortlistItem = { area: string; direction: string; candidates: { label: string; href: string }[] };

export const shortlist: ShortlistItem[] = [
  {
    area: "Home hero",
    direction: "Full-width navy hero, one headline, one line, Start free + How it works, static Sample report card beside it. CSS grain/gradient instead of WebGL (70 KB budget).",
    candidates: [
      { label: "Hero (Berat Berkay Gökdemir)", href: "https://21st.dev/@beratberkayg/components/hero-1" },
      { label: "Responsive Hero Banner (Saifullah Channa)", href: "https://21st.dev/@sensewood8/components/responsive-hero-banner" },
      { label: "SaaS Template (vvisedev Crafts)", href: "https://21st.dev/@waleedkibhen/components/saa-s-template" },
      { label: "HorizonX landing templates (reference)", href: "https://horizonx.so/" },
    ],
  },
  {
    area: "Product cards and 'why' points",
    direction: "Four product cards in a grid; three 'why' points as a bento row with line icons.",
    candidates: [
      { label: "Grid Feature Cards (Efferd)", href: "https://21st.dev/@efferd/components/grid-feature-cards" },
      { label: "Features 8 (Méschac Irung)", href: "https://21st.dev/@meschacirung/components/features-8" },
      { label: "Feature Sections (prebuiltui)", href: "https://21st.dev/@prebuiltui/components/feature-sections/features-section-with-gradient-bg" },
    ],
  },
  {
    area: "Register, log in, reset",
    direction: "Centred card, username and password only, show/hide password, plain error text under fields.",
    candidates: [
      { label: "Clean & Minimal sign in (Preet Suthar)", href: "https://21st.dev/@preetsuthar17/components/clean-minimal-sign-in" },
      { label: "Modern & Stunning sign in (Preet Suthar)", href: "https://21st.dev/@preetsuthar17/components/modern-stunning-sign-in" },
      { label: "SignInPage (Bhomik)", href: "https://21st.dev/@bhomikproductivitylab/components/sign-in-page" },
    ],
  },
  {
    area: "App shell",
    direction: "Left sidebar (Dashboard, New report, My reports, Account), bottom sheet on phones, header with User ID.",
    candidates: [
      { label: "21st.dev sidebars (95)", href: "https://21st.dev/community/components/s/sidebar" },
      { label: "HorizonX SaaS dashboards (reference)", href: "https://horizonx.so/" },
    ],
  },
  {
    area: "Report forms",
    direction: "Step list on the left, form in the centre, answer summary on the right; drop zone with per-file progress.",
    candidates: [
      { label: "21st.dev steppers (124)", href: "https://21st.dev/community/components/s/steps" },
      { label: "21st.dev file uploads (154)", href: "https://21st.dev/community/components/s/upload-download" },
    ],
  },
  {
    area: "Admin",
    direction: "Six tiles, server-rendered SVG charts, dense filterable tables.",
    candidates: [
      { label: "21st.dev dashboards (400)", href: "https://21st.dev/community/components/s/dashboard" },
      { label: "HorizonX dashboard kits (reference)", href: "https://horizonx.so/" },
    ],
  },
];
