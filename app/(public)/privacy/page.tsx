import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";
import { legal, site } from "@/content/site";

export const metadata: Metadata = { title: "Privacy Notice", alternates: { canonical: "/privacy" } };

const retention = [
  ["Account (username, password hash, recovery key hash)", "Until you delete your account"],
  ["Reports, inputs and results", "Until you delete the report or your account"],
  ["Uploaded files", "90 days after the last report run that used them, or earlier if you delete them"],
  ["Sign-in protection records (salted hash of network address)", "24 hours"],
  ["Usage events by anonymous User ID", "24 months; daily totals without User IDs are kept"],
  ["Technical failure records of report runs", "30 days"],
];

const processors = [
  ["Neon (database)", "Singapore", "Stores accounts, reports and usage records"],
  ["UploadThing (file storage)", "Asia region", "Stores your uploaded files privately"],
  ["VectorShift (report pipelines)", "Provider infrastructure", "Processes your inputs and files to produce reports"],
  ["Netlify (hosting)", "Provider infrastructure", "Runs the website and application"],
];

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Notice" version={legal.privacyVersion}>
      <p>
        This notice explains how {site.owner} (&quot;GRID&quot;) handles personal data in {site.name}, in line with
        the Data Privacy Act of 2012 (Republic Act No. 10173) and its implementing rules.
      </p>
      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account:</strong> your username, a one-way hash of your password and of your recovery key, the Terms
          and Privacy versions you accepted, and your anonymous User ID. We do not ask for your name, email or phone
          number.
        </li>
        <li>
          <strong>Your content:</strong> the report inputs you enter, the files you upload and the reports produced.
        </li>
        <li>
          <strong>Security records:</strong> failed sign-in counts and a salted hash of your network address, kept for
          24 hours to stop password guessing. We never store the address itself.
        </li>
        <li>
          <strong>Usage events:</strong> actions such as sign-in, report run or file upload, recorded against your User
          ID only, with no network address, device fingerprint or free text.
        </li>
      </ul>
      <h2>Why we use it</h2>
      <ul>
        <li>To provide the service you signed up for: your account and your reports.</li>
        <li>To keep the service secure and to support you when you contact us with your User ID.</li>
        <li>To understand how the service is used, by anonymous User ID only, so we can improve it.</li>
      </ul>
      <p>
        GRID staff who monitor usage see User IDs and counts only. They cannot see usernames, passwords, report inputs,
        file names or report content.
      </p>
      <h2>Who processes it for us</h2>
      <table>
        <thead>
          <tr>
            <th>Provider</th>
            <th>Location</th>
            <th>Purpose</th>
          </tr>
        </thead>
        <tbody>
          {processors.map(([a, b, c]) => (
            <tr key={a}>
              <td>{a}</td>
              <td>{b}</td>
              <td>{c}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>We do not sell personal data and we do not use advertising or tracking cookies.</p>
      <h2>How long we keep it</h2>
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Kept for</th>
          </tr>
        </thead>
        <tbody>
          {retention.map(([a, b]) => (
            <tr key={a}>
              <td>{a}</td>
              <td>{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Cookies</h2>
      <p>
        We use only the cookies needed to run the service: <code>grid_session</code> keeps you signed in (HttpOnly) and{" "}
        <code>grid_signed_in</code> tells public pages to show &quot;Go to dashboard&quot;. Neither is used for tracking.
      </p>
      <h2>Your rights</h2>
      <p>
        Under the Data Privacy Act you may ask to be informed, to access, correct or erase your data, to object, and to
        data portability, and you may file a complaint with the National Privacy Commission. You can delete your account
        and all its data yourself from the Account page.
      </p>
      <h2>Contact</h2>
      {/* GRID-DECISION: Data Protection Officer contact details. */}
      <p>Contact GRID support, or GRID&apos;s Data Protection Officer (contact details to be added by GRID).</p>
    </LegalPage>
  );
}
