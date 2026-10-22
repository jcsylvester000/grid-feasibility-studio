/**
 * Teaser Scan upload form (BRD v2.0 S-03 "Teaser Scan", Teaser design S-17): files through teaserMedia,
 * pasted post text, "My relationship to this listing" (required) and the consent line. At least one file
 * or the pasted text is needed (checked by the form and by the run service).
 */
import { validateForm } from "./engine";
import type { FormContext, FormDefinition, Intake } from "./types";

export const TEASER_CONSENT = "I have the right to share these files with GRID for analysis. Contact details in them will be hidden.";

export const teaserForm: FormDefinition = {
  product: "teaser_intake",
  steps: [
    {
      key: "teaser",
      title: "Teaser",
      documents: true,
      lede: "Upload the teaser graphic, fact sheet, screenshots or a short video, and paste the post text if you have it. We read them, check the claims and pre-fill a Quick Report for you to confirm.",
      note: "Nothing is created or shared until you check and confirm the scan. Text inside files is read as data, never as instructions.",
      fields: [
        { key: "teaser.pasted_text", label: "Pasted post text", kind: "textarea", wide: true, placeholder: "Paste the Viber, Messenger or Facebook post here (optional if you upload files)" },
        { key: "teaser.relationship", label: "My relationship to this listing", required: true, wide: true },
        { key: "teaser.consent", label: TEASER_CONSENT, kind: "toggle", required: true, wide: true, hint: "Tick the consent line to scan." },
      ],
    },
  ],
};

export const validateTeaser = (raw: Intake, ctx: FormContext) => validateForm(teaserForm, raw, ctx);
