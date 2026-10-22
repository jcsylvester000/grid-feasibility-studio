/**
 * Loads GRID's JSON schema set (copied byte-identical from the Feasibility Studio blueprint,
 * BRD 8.2) into one Ajv 2020-12 instance. Every schema has additionalProperties: false.
 */
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import common from "./schemas/common.schema.json";
import envelope from "./schemas/envelope.schema.json";
import executiveSummary from "./schemas/executive_summary.schema.json";
import feasibilityReport from "./schemas/feasibility_report.schema.json";
import nodeIo from "./schemas/node_io.schema.json";
import quickReport from "./schemas/quick_report.schema.json";
import runRequest from "./schemas/run_request.schema.json";
import teaserIntake from "./schemas/teaser_intake.schema.json";

export const SCHEMA_BASE = "https://schemas.grid.ph/feasibility-studio/v1/";

export const schemaFiles = {
  "common.schema.json": common,
  "envelope.schema.json": envelope,
  "executive_summary.schema.json": executiveSummary,
  "feasibility_report.schema.json": feasibilityReport,
  "node_io.schema.json": nodeIo,
  "quick_report.schema.json": quickReport,
  "run_request.schema.json": runRequest,
  "teaser_intake.schema.json": teaserIntake,
} as const;

let ajv: Ajv2020 | null = null;

export function getAjv(): Ajv2020 {
  if (ajv) return ajv;
  // strict: false because the GRID schemas use annotation keywords (description, default)
  // inside if/then and $defs that Ajv strict mode would flag; validation itself is unaffected.
  const instance = new Ajv2020({ allErrors: true, strict: false });
  addFormats(instance);
  for (const s of Object.values(schemaFiles)) instance.addSchema(s as object);
  ajv = instance;
  return instance;
}

export function validatorFor(file: keyof typeof schemaFiles) {
  const id = SCHEMA_BASE + file;
  const v = getAjv().getSchema(id);
  if (!v) throw new Error(`Schema not registered: ${file}`);
  return v;
}
