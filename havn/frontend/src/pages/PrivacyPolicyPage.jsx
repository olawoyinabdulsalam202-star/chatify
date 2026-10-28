import LegalPage, { LegalSection } from "../components/LegalPage";

function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="September 4, 2026"
      intro="Havn is built to be a quiet, private place to talk. This policy explains what we collect, why, and the choices you have. We keep it in plain language on purpose."
    >
      <LegalSection heading="1. Who we are">
        <p>
          Havn is a private messaging service that lets you exchange messages, voice notes, photos, videos,
          and calls with the people you choose. When this policy says "we" or "Havn", it means the team that
          operates the service.
        </p>
      </LegalSection>

      <LegalSection heading="2. Information we collect">
        <p>We only collect what we need to run Havn:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <span className="font-medium text-[#141311]">Account details</span> — your email address, display
            name, unique handle, and a securely hashed password. We never store your password in a readable
            form.
          </li>
          <li>
            <span className="font-medium text-[#141311]">Your content</span> — the messages, voice notes,
            photos, videos, and stories you send, kept so we can deliver them to your conversations.
          </li>
          <li>
            <span className="font-medium text-[#141311]">Technical basics</span> — limited device and
            connection information needed to keep the service secure and working, and the notification
            subscription your device creates if you turn on push notifications.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="3. How we use your information">
        <p>Your information is used to operate the service, and nothing more:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>To deliver your messages, calls, and media to the right people.</li>
          <li>To verify your account and keep it secure from abuse.</li>
          <li>To send notifications you have asked for, on the devices you enabled them on.</li>
          <li>To provide support and respond to problems you report.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="4. What we never do">
        <p>
          We do not sell your data. We do not show you ads. We do not track you across other websites or
          build an advertising profile of you, and we do not read your conversations to target you. Havn is a
          space that works for you, not for advertisers.
        </p>
      </LegalSection>

      <LegalSection heading="5. Service providers">
        <p>
          Running a messaging service takes a few trusted partners. They only ever receive the information
          needed to do their specific job, and they are not permitted to use it for anything else:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Cloud media storage, to hold the photos, videos, and voice notes you send.</li>
          <li>An email provider, to send verification codes and account emails.</li>
          <li>Push notification services operated by your device or browser maker, to deliver alerts.</li>
          <li>Security and abuse-prevention tooling, to keep the service safe.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="6. Data retention">
        <p>
          We keep your information for as long as your account is active. When you delete a message it is
          removed, and when you delete your account we remove your personal data, except where we are required
          to keep certain records to meet a legal obligation or to resolve a dispute.
        </p>
      </LegalSection>

      <LegalSection heading="7. Your rights and choices">
        <p>
          You are in control of your data. You can edit your profile, delete messages, manage which devices
          receive notifications, and delete your account at any time. If you would like a copy of your data or
          have a request about it, contact us and we will help.
        </p>
      </LegalSection>

      <LegalSection heading="8. Security">
        <p>
          Connections to Havn are encrypted in transit, passwords are stored only as secure hashes, and access
          to systems is limited to what is necessary to operate them. No online service can promise perfect
          security, but protecting your conversations is a first-order priority, not an afterthought.
        </p>
      </LegalSection>

      <LegalSection heading="9. Children">
        <p>
          Havn is not intended for children under 13, and we do not knowingly collect information from them. If
          you believe a child has created an account, please contact us so we can remove it.
        </p>
      </LegalSection>

      <LegalSection heading="10. Changes to this policy">
        <p>
          We may update this policy as Havn grows. When we do, we will change the date at the top of this page,
          and for significant changes we will let you know in the app.
        </p>
      </LegalSection>

      <LegalSection heading="11. Contact us">
        <p>
          Questions about your privacy? Reach us at{" "}
          <a href="mailto:privacy@havn.app" className="font-medium text-[#C2410C] hover:underline">
            privacy@havn.app
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}

export default PrivacyPolicyPage;
