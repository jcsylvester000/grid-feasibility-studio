/**
 * Upload rules (BRD v2.0 section 9). Shared by the drop zone (client) and the upload routes (server).
 * Documents follow run_request.schema.json documents[].mime (PDF, JPEG, PNG, HEIC). BRD section 9 also lists
 * WebP, but the pipeline contract does not accept it yet (ledger GFS-05), so WebP is refused for documents.
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

/**
 * Teaser Scan media (BRD v2.0 section 9, Teaser design 3.1): images (incl. WebP) and PDF up to 25 MB,
 * MP4 or MOV up to 200 MB, 10 files. The pipeline checks video length (3 minutes). The app also caps a
 * scan at 300 MB in total because files pass through the run worker's memory (judgment; ledger GFS-23).
 */
export const TEASER_RULES = {
  maxBytes: 25 * 1024 * 1024,
  maxVideoBytes: 200 * 1024 * 1024,
  maxTotalBytes: 300 * 1024 * 1024,
  maxFiles: 10,
  mimes: ["application/pdf", "image/jpeg", "image/png", "image/heic", "image/webp", "video/mp4", "video/quicktime"] as const,
  extensions: [".pdf", ".jpg", ".jpeg", ".png", ".heic", ".webp", ".mp4", ".mov"],
  products: ["teaser_intake"] as const,
  retentionDays: 90,
};

export type UploadRoute = "documents" | "teaserMedia";
export const routeFor = (product: string): UploadRoute | null =>
  (DOCUMENT_RULES.products as readonly string[]).includes(product) ? "documents" : product === "teaser_intake" ? "teaserMedia" : null;
export const rulesFor = (route: UploadRoute) => (route === "teaserMedia" ? TEASER_RULES : DOCUMENT_RULES);

export type DocumentMime = (typeof DOCUMENT_RULES.mimes)[number];

export const MESSAGES = {
  tooBig: "Files must be 25 MB or smaller",
  videoTooBig: "Videos must be 200 MB or smaller",
  totalTooBig: "A scan can hold up to 300 MB in total",
  badType: "Use a PDF, JPG, PNG or HEIC file",
  badTeaserType: "Use an image (JPG, PNG, HEIC, WebP), a PDF or an MP4 or MOV video",
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

const EXT_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".heic": "image/heic",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
};

/** HEIC files often arrive with an empty type from the browser; infer from the extension. */
export function mimeOf(name: string, type: string): string {
  if (type) return type === "image/jpg" ? "image/jpeg" : type;
  return EXT_MIME[name.toLowerCase().slice(name.lastIndexOf("."))] ?? "";
}

/**
 * Plain-language reason a file is refused, or null when it is acceptable.
 * countAfter: files on the report including this one; bytesBefore: bytes already on the report.
 */
export function checkFile(file: { name: string; size: number; type: string }, countAfter: number, route: UploadRoute = "documents", bytesBefore = 0): string | null {
  const mime = mimeOf(file.name, file.type);
  if (route === "teaserMedia") {
    if (!(TEASER_RULES.mimes as readonly string[]).includes(mime)) return MESSAGES.badTeaserType;
    const video = mime.startsWith("video/");
    if (file.size > (video ? TEASER_RULES.maxVideoBytes : TEASER_RULES.maxBytes)) return video ? MESSAGES.videoTooBig : MESSAGES.tooBig;
    if (bytesBefore + file.size > TEASER_RULES.maxTotalBytes) return MESSAGES.totalTooBig;
  } else {
    if (!(DOCUMENT_RULES.mimes as readonly string[]).includes(mime)) return MESSAGES.badType;
    if (file.size > DOCUMENT_RULES.maxBytes) return MESSAGES.tooBig;
  }
  if (file.size === 0) return "The file is empty";
  if (countAfter > DOCUMENT_RULES.maxFiles) return MESSAGES.tooMany;
  return null;
}

export function formatBytes(n: number) {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}
