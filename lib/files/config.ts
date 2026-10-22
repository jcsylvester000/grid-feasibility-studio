/**
 * Upload rules (BRD v2.0 section 9). Shared by the drop zone (client) and the upload routes (server).
 * Types follow run_request.schema.json documents[].mime (PDF, JPEG, PNG, HEIC). BRD section 9 also lists
 * WebP, but the pipeline contract does not accept it yet (ledger GFS-05), so WebP is refused for now.
 */
export const DOCUMENT_RULES = {
  maxBytes: 25 * 1024 * 1024,
  maxFiles: 10,
  mimes: ["application/pdf", "image/jpeg", "image/png", "image/heic"] as const,
  extensions: [".pdf", ".jpg", ".jpeg", ".png", ".heic"],
  /** Products whose form has the Documents step. */
  products: ["executive_summary", "feasibility_report"] as const,
  /** Files are deleted this long after the last run that used them (UP-06). */
  retentionDays: 90,
};

export type DocumentMime = (typeof DOCUMENT_RULES.mimes)[number];

export const MESSAGES = {
  tooBig: "Files must be 25 MB or smaller",
  badType: "Use a PDF, JPG, PNG or HEIC file",
  tooMany: "Up to 10 files per report",
};

/** Document kinds (field dictionary docs.* keys). The user tags each file; L4 needs title, zoning and a survey or geotechnical report. */
export const DOC_TYPES = [
  { value: "title_documents", label: "Title (TCT/CCT)" },
  { value: "tax_declaration", label: "Tax declaration" },
  { value: "zoning_certificate", label: "Zoning certificate" },
  { value: "site_survey", label: "Survey plan" },
  { value: "geotechnical_report", label: "Geotechnical report" },
  { value: "environmental_permits", label: "ECC or CNC" },
  { value: "other", label: "Other document" },
] as const;

export type DocType = (typeof DOC_TYPES)[number]["value"];
export const isDocType = (v: unknown): v is DocType => DOC_TYPES.some((d) => d.value === v);

/** HEIC files often arrive with an empty type from the browser; infer from the extension. */
export function mimeOf(name: string, type: string): string {
  if (type) return type === "image/jpg" ? "image/jpeg" : type;
  const ext = name.toLowerCase().slice(name.lastIndexOf("."));
  return ({ ".pdf": "application/pdf", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".heic": "image/heic" } as Record<string, string>)[ext] ?? "";
}

/** Plain-language reason a file is refused, or null when it is acceptable. */
export function checkFile(file: { name: string; size: number; type: string }, countAfter: number): string | null {
  if (!(DOCUMENT_RULES.mimes as readonly string[]).includes(mimeOf(file.name, file.type))) return MESSAGES.badType;
  if (file.size > DOCUMENT_RULES.maxBytes) return MESSAGES.tooBig;
  if (file.size === 0) return "The file is empty";
  if (countAfter > DOCUMENT_RULES.maxFiles) return MESSAGES.tooMany;
  return null;
}

export function formatBytes(n: number) {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}
