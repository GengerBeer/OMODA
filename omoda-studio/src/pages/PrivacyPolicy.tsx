import { LegalPageLayout } from '@/components/LegalPageLayout';
import {
  LEGAL_BRAND_NAME,
  LEGAL_COMPANY_NAME,
  LEGAL_LAST_UPDATED,
  LEGAL_SUBPROCESSORS,
} from '@/lib/legal';

export default function PrivacyPolicy() {
  return (
    <LegalPageLayout
      eyebrow="Privacy Policy"
      title={`${LEGAL_BRAND_NAME} Privacy Policy`}
      description={`This Privacy Policy explains how ${LEGAL_COMPANY_NAME} collects, uses, stores, and shares personal data when you use ${LEGAL_BRAND_NAME}.`}
    >
      <section className="space-y-3">
        <h2>1. Controller Information</h2>
        <p>
          {LEGAL_COMPANY_NAME} is the controller responsible for the processing described in this Policy.
          Privacy-related requests may be submitted through the official contact channels made available by the company
          on the Site or in applicable commercial documentation.
        </p>
        <p>
          Last updated:
          {' '}
          <strong>{LEGAL_LAST_UPDATED}</strong>
        </p>
      </section>

      <section className="space-y-3">
        <h2>2. Scope</h2>
        <p>
          This Policy applies to the {LEGAL_BRAND_NAME} website, its image-generation workflows, related storage,
          and support communications. It covers information you provide directly, information created during generation,
          and certain technical data processed so the service can run securely.
        </p>
      </section>

      <section className="space-y-3">
        <h2>3. Data We Process</h2>
        <p>Depending on how you use the service, we may process:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>uploaded garment images, layered outfit references, face photos, body photos, and optional background images;</li>
          <li>free-text prompts, model descriptions, and generation settings;</li>
          <li>generated output images and related status records;</li>
          <li>technical data such as timestamps, request identifiers, error logs, and storage paths;</li>
          <li>communications you send to us, including support or legal/privacy requests.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2>4. How We Obtain Data</h2>
        <p>We obtain personal data primarily from:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>files and prompts you submit through the website;</li>
          <li>generated content created from your submissions;</li>
          <li>hosting, storage, and delivery infrastructure required to operate the service.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2>5. Purposes And Legal Bases</h2>
        <p>We process personal data for the following purposes and, where GDPR applies, on the following legal bases:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>to provide the generation service you request, including storing inputs and returning outputs: performance of a contract or pre-contractual steps;</li>
          <li>to secure, maintain, debug, and improve the service: legitimate interests;</li>
          <li>to comply with legal obligations, respond to lawful requests, and maintain records where required: legal obligation;</li>
          <li>to process face or body photos, or other content that may reveal sensitive personal information, when you choose to upload it for personalization: your consent and, where applicable, your explicit action in submitting that content.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2>6. AI Processing And Service Providers</h2>
        <p>
          To deliver {LEGAL_BRAND_NAME}, we rely on third-party infrastructure and subprocessors. At the time of this
          Policy, the main providers used by the service are:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          {LEGAL_SUBPROCESSORS.map((processor) => (
            <li key={processor.name}>
              <strong>{processor.name}</strong>
              : {processor.purpose}.
            </li>
          ))}
        </ul>
        <p>
          Uploaded images and prompts may be transmitted to these providers strictly for service delivery, storage,
          hosting, or generation.
        </p>
      </section>

      <section className="space-y-3">
        <h2>7. International Transfers</h2>
        <p>
          Because our providers may store or process data in multiple jurisdictions, personal data may be transferred
          outside your country or, where applicable, outside the EEA/UK. Where GDPR applies, we rely on appropriate
          safeguards such as contractual protections, provider commitments, and other lawful transfer mechanisms as
          available.
        </p>
      </section>

      <section className="space-y-3">
        <h2>8. Retention</h2>
        <p>
          We retain uploaded images, prompts, generated results, and technical records for as long as needed to operate,
          secure, troubleshoot, and document the service, unless a shorter period is required by law or a valid deletion
          request applies. In practice, some records may remain in backups or logs for a limited time after deletion.
        </p>
      </section>

      <section className="space-y-3">
        <h2>9. Your Privacy Rights</h2>
        <p>
          Subject to applicable law, you may have the right to request access, correction, deletion, restriction,
          portability, objection, or withdrawal of consent. If you want to exercise any of these rights, you may do so
          through the official company contact channels made available on the Site.
        </p>
      </section>

      <section className="space-y-3">
        <h2>10. Children</h2>
        <p>
          {LEGAL_BRAND_NAME} is not intended for children, and we do not knowingly request the upload of children’s
          personal data. If you believe a child has submitted personal data to the service, contact us so we can review
          and delete it where appropriate.
        </p>
      </section>

      <section className="space-y-3">
        <h2>11. Security</h2>
        <p>
          We use reasonable technical and organizational measures intended to reduce the risk of unauthorized access,
          alteration, disclosure, or loss. However, no internet-based service can guarantee absolute security.
        </p>
      </section>

      <section className="space-y-3">
        <h2>12. Changes To This Policy</h2>
        <p>
          We may update this Policy from time to time to reflect operational, legal, or product changes. When we do, we
          will revise the “Last updated” date above and publish the new version on the Site.
        </p>
      </section>
    </LegalPageLayout>
  );
}
