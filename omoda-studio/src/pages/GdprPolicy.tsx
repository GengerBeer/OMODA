import { LegalPageLayout } from '@/components/LegalPageLayout';
import {
  LEGAL_BRAND_NAME,
  LEGAL_COMPANY_NAME,
  LEGAL_CONTACT_ADDRESS,
  LEGAL_CONTACT_EMAIL,
  LEGAL_LAST_UPDATED,
  LEGAL_SUBPROCESSORS,
} from '@/lib/legal';

export default function GdprPolicy() {
  return (
    <LegalPageLayout
      eyebrow="GDPR Policy"
      title={`${LEGAL_BRAND_NAME} GDPR Policy`}
      description={`This document explains how ${LEGAL_COMPANY_NAME} approaches GDPR-related processing for ${LEGAL_BRAND_NAME}, including legal bases, rights handling, and transfer safeguards.`}
    >
      <section className="space-y-3">
        <h2>1. Controller</h2>
        <p>
          For GDPR purposes, the controller is
          {' '}
          <strong>{LEGAL_COMPANY_NAME}</strong>.
          {' '}
          Privacy requests may be sent to
          {' '}
          <strong>{LEGAL_CONTACT_EMAIL}</strong>
          {' '}
          or
          {' '}
          <strong>{LEGAL_CONTACT_ADDRESS}</strong>.
        </p>
        <p>
          Last updated:
          {' '}
          <strong>{LEGAL_LAST_UPDATED}</strong>
        </p>
      </section>

      <section className="space-y-3">
        <h2>2. Personal Data In Scope</h2>
        <p>
          {LEGAL_BRAND_NAME} may process personal data contained in uploaded outfit references, face and body photos,
          background images, prompts, generated outputs, support messages, and technical usage records needed to run the
          service.
        </p>
      </section>

      <section className="space-y-3">
        <h2>3. Purposes Of Processing</h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>providing AI-assisted virtual try-on generation and returning outputs;</li>
          <li>storing, retrieving, and organizing assets related to generation requests;</li>
          <li>maintaining platform reliability, fraud prevention, security, and troubleshooting;</li>
          <li>responding to support, privacy, or legal requests;</li>
          <li>complying with applicable legal obligations.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2>4. GDPR Legal Bases</h2>
        <p>Where GDPR applies, we generally rely on the following bases:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Contract / pre-contract steps</strong>
            : when processing is necessary to provide the requested image-generation service.
          </li>
          <li>
            <strong>Legitimate interests</strong>
            : for service security, diagnostics, abuse prevention, reliability, and internal operational control.
          </li>
          <li>
            <strong>Legal obligation</strong>
            : where records or disclosures are required by law.
          </li>
          <li>
            <strong>Consent</strong>
            : where you voluntarily submit personal imagery for personalization features.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2>5. Sensitive Or Special Category Data</h2>
        <p>
          Some user-uploaded images may reveal sensitive information or may qualify as special category data under GDPR
          depending on context. If you upload face or body imagery, you are choosing to submit that content for the
          generation feature. Where special category processing is implicated, we treat your voluntary submission for
          this purpose as the relevant user permission basis and process the data only to deliver the requested result,
          secure the service, and comply with law.
        </p>
      </section>

      <section className="space-y-3">
        <h2>6. Automated Processing</h2>
        <p>
          {LEGAL_BRAND_NAME} uses automated tools, including AI image generation, to create requested outputs. However,
          the service is not designed to make solely automated decisions that produce legal effects or similarly
          significant effects about you within the meaning of GDPR Article 22.
        </p>
      </section>

      <section className="space-y-3">
        <h2>7. Recipients And Processors</h2>
        <p>The main categories of processors supporting the service currently include:</p>
        <ul className="list-disc space-y-2 pl-6">
          {LEGAL_SUBPROCESSORS.map((processor) => (
            <li key={processor.name}>
              <strong>{processor.name}</strong>
              : {processor.purpose}.
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2>8. International Data Transfers</h2>
        <p>
          Because our hosting, storage, and AI providers may operate internationally, personal data may be transferred
          outside the EEA. Where required, we rely on lawful transfer mechanisms and contractual safeguards made
          available by our providers.
        </p>
      </section>

      <section className="space-y-3">
        <h2>9. Retention</h2>
        <p>
          We keep personal data only for as long as reasonably necessary to provide the service, maintain security,
          resolve incidents, support lawful requests, and document operations. Retention periods may vary by data type,
          infrastructure constraints, and backup cycles.
        </p>
      </section>

      <section className="space-y-3">
        <h2>10. Data Subject Rights</h2>
        <p>Subject to GDPR and applicable limitations, you may request:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>access to your personal data;</li>
          <li>rectification of inaccurate data;</li>
          <li>erasure;</li>
          <li>restriction of processing;</li>
          <li>data portability where applicable;</li>
          <li>objection to processing based on legitimate interests;</li>
          <li>withdrawal of consent where processing depends on consent.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2>11. How To Exercise Rights</h2>
        <p>
          To exercise your GDPR rights, contact
          {' '}
          <strong>{LEGAL_CONTACT_EMAIL}</strong>
          {' '}
          with enough detail for us to identify the request and, where necessary, verify identity before acting.
        </p>
      </section>

      <section className="space-y-3">
        <h2>12. Complaints</h2>
        <p>
          If you believe your personal data has been handled in breach of GDPR, you may contact us first so we can try
          to resolve the issue. You also have the right to lodge a complaint with the competent supervisory authority in
          your country of habitual residence, place of work, or place of the alleged infringement.
        </p>
      </section>

      <section className="space-y-3">
        <h2>13. Security Measures</h2>
        <p>
          We apply reasonable technical and organizational safeguards designed to protect stored data, limit access,
          monitor platform issues, and reduce the risk of misuse. No system can be guaranteed 100% secure, but security
          is considered in how the service is hosted and operated.
        </p>
      </section>
    </LegalPageLayout>
  );
}
