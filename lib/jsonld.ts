/**
 * JSON-LD for structured data. React would HTML-escape a <script> child, which breaks JSON, so this
 * is the one vetted use of dangerouslySetInnerHTML besides the print stylesheet (SE-03). "<" is
 * escaped so the payload can never close the script tag.
 */
export function jsonLdProps(data: Record<string, unknown>) {
  return {
    type: "application/ld+json",
    dangerouslySetInnerHTML: { __html: JSON.stringify(data).replace(/</g, "\\u003c") },
  } as const;
}
