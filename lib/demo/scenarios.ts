/**
 * Twenty demo scenarios for team demos and training (prototype). Every place name is a real city, but every
 * property, person, company and figure is INVENTED for the demo. Reports are built by the stand-in pipeline
 * (lib/demo/engine.ts) from these inputs until the VectorShift pipelines are connected.
 * Keys are the app's field-dictionary keys, so each scenario can also be opened and re-run in the form.
 */
import type { DemoProduct } from "./engine";

export type Scenario = {
  code: string;
  product: DemoProduct;
  title: string;
  who: string; // the user in the story
  situation: string; // why they run the report
  show: string; // what to point out in the demo
  intake: Record<string, unknown>;
};

const loc = (region: string, province: string, city: string) => ({ "property.region": region, "property.province": province, "property.city": city });
const NCR = (city: string) => loc("NCR", "Metro Manila", city);
const CAVITE = (city: string) => loc("CALABARZON (Region IV-A)", "Cavite", city);
const LAGUNA = (city: string) => loc("CALABARZON (Region IV-A)", "Laguna", city);
const BATANGAS = (city: string) => loc("CALABARZON (Region IV-A)", "Batangas", city);
const RIZAL = (city: string) => loc("CALABARZON (Region IV-A)", "Rizal", city);
const CEBU = (city: string) => loc("Central Visayas (Region VII)", "Cebu", city);

const leaseFin = (land: number, build: number, area: number, rent: number, extra: Record<string, unknown> = {}) => ({
  "fin.enabled": true,
  "fin.land_cost": land,
  "fin.build_cost": build,
  "fin.soft_pct": 10,
  "fin.leasable_area": area,
  "fin.rent_per_sqm_month": rent,
  "fin.occupancy": 85,
  "fin.opex_pct": 20,
  "fin.escalation": 5,
  "fin.exit_cap": 8,
  "fin.selling_pct": 3,
  "fin.construction_months": 18,
  "fin.equity_pct": 40,
  "fin.loan_rate": 8,
  "fin.discount_rate": 12,
  "fin.tax_rate": 25,
  ...extra,
});
const saleFin = (land: number, build: number, area: number, price: number, extra: Record<string, unknown> = {}) => ({
  "fin.enabled": true,
  "fin.land_cost": land,
  "fin.build_cost": build,
  "fin.soft_pct": 10,
  "fin.sellable_area": area,
  "fin.price_per_sqm": price,
  "fin.absorption_months": 36,
  "fin.selling_pct": 6,
  "fin.construction_months": 24,
  "fin.equity_pct": 40,
  "fin.loan_rate": 8,
  "fin.discount_rate": 12,
  "fin.tax_rate": 25,
  ...extra,
});

export const SCENARIOS: Scenario[] = [
  // ------------------------------------------------------------------ Quick Reports
  {
    code: "D01",
    product: "quick_report",
    title: "Demo 01 · Quick Report · C6 Road commercial lot, Taguig",
    who: "Mia, a licensed broker in the south of Metro Manila",
    situation: "A family wants to know by lunch whether their asking price for a 1.5-hectare roadside lot will move.",
    show: "Marginal rating, the price-position bar inside the comparable range, and the flags about asking versus closed prices.",
    intake: { ...NCR("Taguig"), "property.road_access": "major_road", "qd.lot_area": 15000, "qd.floor_area": 0, "qd.ask_psqm": 40000, "qd.comp_low": 30000, "qd.comp_high": 50000, "qd.comp_count": 8, "qd.as_of": 2, "qd.zonal": 25000, "qd.commission": 3, "qd.title_copy": "no", "qd.tax_dec": "no", "qd.mi": "no", "use.goal": "sell", "owner.type": "family_corp" },
  },
  {
    code: "D02",
    product: "quick_report",
    title: "Demo 02 · Quick Report · Inner-street residential lot, Quezon City",
    who: "Carlo, an agent with a buyer looking for a house lot",
    situation: "The seller needs cash quickly and priced below the street; is it really a bargain?",
    show: "Promising rating (asked below comparable listings) and the 'confirm why it is cheap' caution.",
    intake: { ...NCR("Quezon City"), "property.road_access": "inner_road", "qd.lot_area": 300, "qd.floor_area": 0, "qd.ask_psqm": 60000, "qd.comp_low": 70000, "qd.comp_high": 90000, "qd.comp_count": 15, "qd.as_of": 0, "qd.zonal": 35000, "qd.commission": 5, "qd.title_copy": "yes", "qd.tax_dec": "yes", "qd.mi": "no", "use.goal": "sell", "owner.type": "individual" },
  },
  {
    code: "D03",
    product: "quick_report",
    title: "Demo 03 · Quick Report · Small commercial corner lot, Makati",
    who: "Ma'am Tess, a senior broker screening a listing from her network",
    situation: "The owner insists the lot is worth far more than the street; the broker wants a neutral page to talk price.",
    show: "Weak rating (asked above the comparable high) and the premium over comparables in the metrics table.",
    intake: { ...NCR("Makati"), "property.road_access": "secondary_road", "qd.lot_area": 400, "qd.floor_area": 0, "qd.ask_psqm": 400000, "qd.comp_low": 250000, "qd.comp_high": 300000, "qd.comp_count": 8, "qd.as_of": 2, "qd.zonal": 150000, "qd.commission": 3, "qd.title_copy": "yes", "qd.tax_dec": "no", "qd.mi": "no", "use.goal": "sell", "owner.type": "individual" },
  },
  {
    code: "D04",
    product: "quick_report",
    title: "Demo 04 · Quick Report · Mid-size lot near the IT Park, Cebu City",
    who: "A Cebu-based agent preparing for a first client meeting",
    situation: "Comparable listings are plenty and recent; the client asks where the price sits.",
    show: "Marginal rating near the top of the range, and how the bar shows the exact position.",
    intake: { ...CEBU("Cebu City"), "property.road_access": "secondary_road", "qd.lot_area": 2000, "qd.floor_area": 0, "qd.ask_psqm": 90000, "qd.comp_low": 70000, "qd.comp_high": 100000, "qd.comp_count": 15, "qd.as_of": 0, "qd.zonal": 45000, "qd.commission": 5, "qd.title_copy": "yes", "qd.tax_dec": "yes", "qd.mi": "no", "use.goal": "sell", "owner.type": "family_corp" },
  },
  {
    code: "D05",
    product: "quick_report",
    title: "Demo 05 · Quick Report · 5-hectare land at the city edge, Davao City",
    who: "A Davao broker approached by a landowner family",
    situation: "Only two older comparable listings could be found; the price looks low.",
    show: "Promising rating but low confidence: few and older comparables, flagged on the page.",
    intake: { ...loc("Davao Region (Region XI)", "Davao del Sur", "Davao City"), "property.road_access": "secondary_road", "qd.lot_area": 50000, "qd.floor_area": 0, "qd.ask_psqm": 2500, "qd.comp_low": 3000, "qd.comp_high": 4000, "qd.comp_count": 2, "qd.as_of": 9, "qd.zonal": 1500, "qd.commission": 5, "qd.title_copy": "yes", "qd.tax_dec": "yes", "qd.mi": "no", "use.goal": "land_bank", "owner.type": "individual" },
  },
  {
    code: "D06",
    product: "quick_report",
    title: "Demo 06 · Quick Report · Beach-area lot, Lapu-Lapu (no comparables yet)",
    who: "An agent who just received a listing by Viber",
    situation: "There is no comparable data yet; the agent runs the screen anyway to see what is missing.",
    show: "'Can't tell yet': the report lists exactly what to add instead of guessing.",
    intake: { ...CEBU("Lapu-Lapu"), "property.road_access": "inner_road", "qd.lot_area": 1000, "qd.floor_area": 0, "qd.ask_psqm": 35000, "qd.comp_count": 0, "qd.as_of": 2, "qd.zonal": 0, "qd.commission": 5, "qd.title_copy": "no", "qd.tax_dec": "no", "qd.mi": "no" },
  },
  {
    code: "D07",
    product: "quick_report",
    title: "Demo 07 · Quick Report · Warehouse with tenant, San Fernando, Pampanga",
    who: "An industrial broker with an investor client",
    situation: "The property has a 2,000 sqm warehouse with a current tenant; the investor wants the yield picture.",
    show: "The building and rent dropdowns, and the gross yield metric for improved property.",
    intake: { ...loc("Central Luzon (Region III)", "Pampanga", "San Fernando"), "property.road_access": "major_road", "qd.lot_area": 5000, "qd.floor_area": 2000, "qd.rent": 300, "qd.ask_psqm": 20000, "qd.comp_low": 15000, "qd.comp_high": 25000, "qd.comp_count": 8, "qd.as_of": 2, "qd.zonal": 9000, "qd.commission": 3, "qd.title_copy": "yes", "qd.tax_dec": "yes", "qd.mi": "no", "use.goal": "lease", "owner.type": "family_corp" },
  },
  {
    code: "D08",
    product: "quick_report",
    title: "Demo 08 · Quick Report · Downtown lot far above zonal, Iloilo City",
    who: "A broker checking a price before co-brokering",
    situation: "The asking price is many times the BIR zonal value; is that normal for the area?",
    show: "The price-to-zonal flag, and why the report says zonal is a tax floor, not market value.",
    intake: { ...loc("Western Visayas (Region VI)", "Iloilo", "Iloilo City"), "property.road_access": "major_road", "qd.lot_area": 1500, "qd.floor_area": 0, "qd.ask_psqm": 55000, "qd.comp_low": 45000, "qd.comp_high": 65000, "qd.comp_count": 4, "qd.as_of": 5, "qd.zonal": 8000, "qd.commission": 5, "qd.title_copy": "no", "qd.tax_dec": "yes", "qd.mi": "no", "use.goal": "sell", "owner.type": "individual" },
  },

  // ------------------------------------------------------------------ Executive Summaries
  {
    code: "D09",
    product: "executive_summary",
    title: "Demo 09 · Executive Summary · Strip retail on C6 Road, Taguig",
    who: "A GRID analyst preparing a one-page brief for a family corporation",
    situation: "The owner plans community retail to lease and has rough land and build costs.",
    show: "A conditionally feasible verdict, the key figures strip, the 11 summary items and the scope-and-limits list.",
    intake: { ...NCR("Taguig"), "property.name": "C6 Road retail lot (demo)", "property.road_access": "major_road", "property.lot_area": 14323, "use.intended_use": "commercial", "use.detail": "Strip mall / community retail", "use.goal": "lease", "use.horizon": 10, "use.target_irr": 10, "owner.name": "Demo Landholdings Inc.", "owner.type": "family_corp", "owner.track": 3, "owner.years": 7, "market.asking_low": 30000, "market.asking_high": 50000, "market.comps_count": 8, "market.as_of": "2026-10-01", ...leaseFin(600000000, 450000000, 9000, 1400) },
  },
  {
    code: "D10",
    product: "executive_summary",
    title: "Demo 10 · Executive Summary · Mid-market house and lot, General Trias",
    who: "A developer's business-development lead",
    situation: "A one-page summary for the board before committing to a full study.",
    show: "How cost, price and funding figures unlock the financial projection and a verdict (input level L3).",
    intake: { ...CAVITE("General Trias"), "property.name": "General Trias estate (demo)", "property.road_access": "secondary_road", "property.lot_area": 50000, "use.intended_use": "residential_subdivision", "use.detail": "Mid-market house and lot", "use.goal": "sell", "use.horizon": 5, "use.target_irr": 18, "owner.name": "Demo Homes Development Corp.", "owner.type": "developer_established", "owner.track": 3, "owner.years": 7, "market.asking_low": 26000, "market.asking_high": 34000, "market.comps_count": 14, "market.zonal_per_sqm": 6500, ...saleFin(220000000, 300000000, 30000, 30000) },
  },
  {
    code: "D11",
    product: "executive_summary",
    title: "Demo 11 · Executive Summary · Mixed-use corner, Mandaue (no costs yet)",
    who: "An owner's representative exploring options",
    situation: "No cost figures yet; the owner wants to know what can already be said.",
    show: "'Inputs required' for the financial projection and how the page stays honest without numbers.",
    intake: { ...CEBU("Mandaue"), "property.name": "Mandaue corner lot (demo)", "property.road_access": "major_road", "property.lot_area": 4000, "use.intended_use": "mixed_use", "use.goal": "jv", "owner.type": "individual", "market.asking_low": 60000, "market.asking_high": 80000, "market.comps_count": 4 },
  },
  {
    code: "D12",
    product: "executive_summary",
    title: "Demo 12 · Executive Summary · Beach resort site, Nasugbu (first look)",
    who: "A hospitality investor's analyst",
    situation: "Only the location, size and intended use are known.",
    show: "Input level L1: what a first-look summary contains and the next steps it lists.",
    intake: { ...BATANGAS("Nasugbu"), "property.name": "Nasugbu beachfront (demo)", "property.road_access": "secondary_road", "property.lot_area": 20000, "use.intended_use": "hospitality_resort" },
  },
  {
    code: "D13",
    product: "executive_summary",
    title: "Demo 13 · Executive Summary · Logistics warehouse, Davao City",
    who: "A logistics company looking at a build-to-lease warehouse",
    situation: "The company has land and build quotes and a target rent from brokers.",
    show: "A not-feasible verdict for a first-time developer: IRR below the 12% target, and the risks list.",
    intake: { ...loc("Davao Region (Region XI)", "Davao del Sur", "Davao City"), "property.name": "Davao logistics park lot (demo)", "property.road_access": "major_road", "property.lot_area": 10000, "use.intended_use": "industrial_warehouse", "use.goal": "lease", "use.horizon": 10, "use.target_irr": 12, "owner.name": "Demo Logistics Holdings", "owner.type": "developer_first", "owner.track": 0, "owner.years": 3, "market.asking_low": 8000, "market.asking_high": 12000, "market.comps_count": 4, ...leaseFin(100000000, 150000000, 6000, 280, { "fin.occupancy": 90 }) },
  },
  {
    code: "D14",
    product: "executive_summary",
    title: "Demo 14 · Executive Summary · Land banking, Antipolo",
    who: "A family office holding land for later sale",
    situation: "Hold for five years and resell; what should the summary say?",
    show: "The land-bank model (no build cost): appreciation alone does not reach the 12% target.",
    intake: { ...RIZAL("Antipolo"), "property.name": "Antipolo ridge land (demo)", "property.road_access": "inner_road", "property.lot_area": 30000, "use.intended_use": "land_banking", "use.goal": "land_bank", "use.horizon": 5, "owner.name": "Demo Family Office", "owner.type": "fund", "owner.track": 1, "owner.years": 15, "market.asking_low": 5000, "market.asking_high": 8000, "market.comps_count": 8, "fin.enabled": true, "fin.land_cost": 180000000, "fin.appreciation": 10, "fin.selling_pct": 5, "fin.equity_pct": 100, "fin.loan_rate": 8, "fin.discount_rate": 12, "fin.tax_rate": 25 },
  },

  // ------------------------------------------------------------------ Feasibility Reports
  {
    code: "D15",
    product: "feasibility_report",
    title: "Demo 15 · Feasibility Report · Community retail to lease, Taguig",
    who: "A GRID analyst for a landowner family corporation",
    situation: "Full study with costs, funding and the title and tax declaration on file.",
    show: "Cover, contents, the 13 sections, the criteria table and the financial study with scenarios.",
    intake: { ...NCR("Taguig"), toc_mode: "summary_first", "property.name": "C6 Road commercial lot (demo)", "property.barangay": "Calzada-Tipas", "property.address": "C6 Road", "property.road_access": "major_road", "property.lot_area": 14323, "use.intended_use": "commercial", "use.detail": "Strip mall / community retail", "use.goal": "lease", "use.horizon": 10, "use.target_irr": 10, "market.has_mi": "yes", "market.mi_id": "MI-DEMO-C6", "owner.name": "Demo Landholdings Inc.", "owner.type": "family_corp", "owner.track": 3, "owner.years": 7, ...leaseFin(900000000, 520000000, 11000, 1600), "docs.title_documents": true, "docs.tax_declaration": true, zoning_answer: "unknown", hazard_answer: "moderate" },
  },
  {
    code: "D16",
    product: "feasibility_report",
    title: "Demo 16 · Feasibility Report · House-and-lot estate for sale, General Trias",
    who: "A developer seeking bank financing",
    situation: "Full inputs and professional documents (input level L4).",
    show: "The verdict, the break-even and returns, and documents raising the input level.",
    intake: { ...CAVITE("General Trias"), toc_mode: "summary_first", "property.name": "General Trias residential estate (demo)", "property.road_access": "secondary_road", "property.lot_area": 50000, "use.intended_use": "residential_subdivision", "use.detail": "Mid-market house and lot", "use.goal": "sell", "use.horizon": 5, "use.target_irr": 18, "owner.name": "Demo Homes Development Corp.", "owner.type": "developer_established", "owner.track": 3, "owner.years": 7, "market.asking_low": 26000, "market.asking_high": 34000, "market.comps_count": 14, "market.zonal_per_sqm": 6500, "market.as_of": "2026-10-01", ...saleFin(220000000, 300000000, 30000, 30000), "docs.title_documents": true, "docs.tax_declaration": true, "docs.zoning_certificate": true, "docs.site_survey": true, zoning_answer: "permitted", hazard_answer: "low" },
  },
  {
    code: "D17",
    product: "feasibility_report",
    title: "Demo 17 · Feasibility Report · Condominium tower for sale, Bacolod",
    who: "A first-time developer with an optimistic plan",
    situation: "High land and build costs against a modest selling price.",
    show: "A 'not feasible' verdict, the thesis breaker and the downside scenario.",
    intake: { ...loc("Western Visayas (Region VI)", "Negros Occidental", "Bacolod"), toc_mode: "toc_first", "property.name": "Bacolod mid-rise (demo)", "property.road_access": "major_road", "property.lot_area": 3000, "use.intended_use": "residential_condominium", "use.detail": "Mid-rise (up to 12 floors)", "use.goal": "sell", "use.horizon": 5, "use.target_irr": 15, "owner.name": "Demo Towers Inc.", "owner.type": "developer_first", "owner.track": 0, "owner.years": 1, "market.asking_low": 70000, "market.asking_high": 90000, "market.comps_count": 4, ...saleFin(450000000, 1200000000, 15000, 85000), zoning_answer: "conditional", hazard_answer: "low" },
  },
  {
    code: "D18",
    product: "feasibility_report",
    title: "Demo 18 · Feasibility Report · Build-to-lease warehouse, Santa Rosa, Laguna",
    who: "An industrial landlord adding a second warehouse",
    situation: "Costs and funding are set; zoning is permitted but flooding is moderate.",
    show: "A feasible verdict with the moderate-flood limitation still listed, the criteria gates and the statements by year.",
    intake: { ...LAGUNA("Santa Rosa"), toc_mode: "summary_first", "property.name": "Santa Rosa industrial lot (demo)", "property.road_access": "major_road", "property.lot_area": 20000, "use.intended_use": "industrial_warehouse", "use.goal": "lease", "use.horizon": 10, "use.target_irr": 10, "owner.name": "Demo Industrial Estates", "owner.type": "developer_established", "owner.track": 6, "owner.years": 15, "market.asking_low": 12000, "market.asking_high": 18000, "market.comps_count": 8, ...leaseFin(300000000, 360000000, 12000, 650, { "fin.occupancy": 90, "fin.discount_rate": 10 }), "docs.title_documents": true, "docs.zoning_certificate": true, zoning_answer: "permitted", hazard_answer: "moderate" },
  },
  {
    code: "D19",
    product: "feasibility_report",
    title: "Demo 19 · Feasibility Report · Boutique hotel, Tagaytay (no costs yet)",
    who: "A hospitality entrepreneur at the idea stage",
    situation: "Location, use and owner profile only: no cost or funding figures yet.",
    show: "'Insufficient data': no verdict below L3, with every financial part marked 'inputs required'.",
    intake: { ...CAVITE("Tagaytay"), toc_mode: "summary_first", "property.name": "Tagaytay ridge hotel site (demo)", "property.road_access": "major_road", "property.lot_area": 5000, "use.intended_use": "hospitality_resort", "use.goal": "lease", "owner.name": "Demo Hospitality Group", "owner.type": "developer_first", "owner.track": 1, "owner.years": 3 },
  },
  {
    code: "D20",
    product: "feasibility_report",
    title: "Demo 20 · Feasibility Report · Land bank, Cagayan de Oro",
    who: "An investor deciding whether to hold or sell",
    situation: "Buy, hold seven years and resell, with expected appreciation and funding.",
    show: "A land-bank case that narrowly misses the hurdle (about 9% against 10%), and how appreciation drives the result.",
    intake: { ...loc("Northern Mindanao (Region X)", "Misamis Oriental", "Cagayan de Oro"), toc_mode: "summary_first", "property.name": "Cagayan de Oro uptown land (demo)", "property.road_access": "secondary_road", "property.lot_area": 25000, "use.intended_use": "land_banking", "use.goal": "land_bank", "use.horizon": 7, "use.target_irr": 10, "owner.name": "Demo Capital Partners", "owner.type": "fund", "owner.track": 6, "owner.years": 7, "market.asking_low": 6000, "market.asking_high": 9000, "market.comps_count": 8, "fin.enabled": true, "fin.land_cost": 150000000, "fin.appreciation": 12, "fin.selling_pct": 3, "fin.equity_pct": 100, "fin.loan_rate": 8, "fin.discount_rate": 8, "fin.tax_rate": 25 },
  },
];
