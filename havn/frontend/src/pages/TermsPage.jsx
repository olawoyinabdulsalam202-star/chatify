import LegalPage, { LegalSection } from "../components/LegalPage";

function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="September 4, 2026"
      intro="These terms are the agreement between you and Havn for using the service. By creating an account or using Havn, you agree to them, so it is worth a read."
    >
      <LegalSection heading="1. Agreement to these terms">
        <p>
          By creating an account, or by using Havn in any way, you agree to these terms and to our Privacy
          Policy. If you do not agree with them, please do not use the service.
        </p>
      </LegalSection>

      <LegalSection heading="2. Eligibility">
        <p>
          You must be at least 13 years old to use Havn, and old enough to form a binding agreement where you
          live. By using the service you confirm that you meet these requirements.
        </p>
      </LegalSection>

      <LegalSection heading="3. Your account">
        <p>
          You are responsible for keeping your login details safe and for the activity that happens on your
          account. Please give accurate information when you sign up, and let us know promptly if you believe
          someone else has accessed your account.
        </p>
      </LegalSection>

      <LegalSection heading="4. Acceptable use">
        <p>Havn is a place for real conversations. You agree not to use it to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Break the law, or send content that is illegal, harmful, or infringing.</li>
          <li>Harass, threaten, impersonate, or abuse other people.</li>
          <li>Send spam, scams, malware, or unsolicited bulk messages.</li>
          <li>Interfere with the service, or try to access it in ways we have not authorised.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="5. Your content">
        <p>
          The content you send stays yours. To operate the service, you grant Havn the limited permission
          needed to store, transmit, and display that content to the people you send it to. You are responsible
          for what you share, and you confirm you have the right to share it.
        </p>
      </LegalSection>

      <LegalSection heading="6. Our brand">
        <p>
          The Havn name, logo, and the design of the service belong to us. These terms do not give you the
          right to use them without our permission.
        </p>
      </LegalSection>

      <LegalSection heading="7. Service availability">
        <p>
          We work to keep Havn running smoothly, but the service is provided on an "as is" and "as available"
          basis. We may add, change, or remove features, and we cannot guarantee the service will always be
          uninterrupted or error-free.
        </p>
      </LegalSection>

      <LegalSection heading="8. Suspension and termination">
        <p>
          You can stop using Havn and delete your account at any time. We may suspend or close an account that
          breaks these terms or puts other people or the service at risk.
        </p>
      </LegalSection>

      <LegalSection heading="9. Disclaimers and liability">
        <p>
          To the extent the law allows, Havn is provided without warranties of any kind, and we are not liable
          for indirect or incidental losses arising from your use of the service. Nothing in these terms limits
          rights that cannot be limited under the law that applies to you.
        </p>
      </LegalSection>

      <LegalSection heading="10. Changes to these terms">
        <p>
          We may update these terms from time to time. When we do, we will change the date at the top of this
          page, and continuing to use Havn after a change means you accept the updated terms.
        </p>
      </LegalSection>

      <LegalSection heading="11. Contact us">
        <p>
          Questions about these terms? Reach us at{" "}
          <a href="mailto:support@havn.app" className="font-medium text-[#C2410C] hover:underline">
            support@havn.app
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}

export default TermsPage;
