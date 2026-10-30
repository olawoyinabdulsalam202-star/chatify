import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import AppScreen from "../../../components/AppScreen";
import { useTheme } from "../../../lib/theme";
import Icon from "../../../components/Icon";

const documents = {
  terms: {
    title: "Terms of Service",
    updated: "September 4, 2026",
    intro: "These terms are the agreement between you and Havn for using the service. By creating an account or using Havn, you agree to them, so it is worth a read.",
    sections: [
      ["1. Agreement to these terms", ["By creating an account, or by using Havn in any way, you agree to these terms and to our Privacy Policy. If you do not agree with them, please do not use the service."]],
      ["2. Eligibility", ["You must be at least 13 years old to use Havn, and old enough to form a binding agreement where you live. By using the service you confirm that you meet these requirements."]],
      ["3. Your account", ["You are responsible for keeping your login details safe and for the activity that happens on your account. Please give accurate information when you sign up, and let us know promptly if you believe someone else has accessed your account."]],
      ["4. Acceptable use", ["Havn is a place for real conversations. You agree not to use it to:", "Break the law, or send content that is illegal, harmful, or infringing.", "Harass, threaten, impersonate, or abuse other people.", "Send spam, scams, malware, or unsolicited bulk messages.", "Interfere with the service, or try to access it in ways we have not authorised."]],
      ["5. Your content", ["The content you send stays yours. To operate the service, you grant Havn the limited permission needed to store, transmit, and display that content to the people you send it to. You are responsible for what you share, and you confirm you have the right to share it."]],
      ["6. Our brand", ["The Havn name, logo, and the design of the service belong to us. These terms do not give you the right to use them without our permission."]],
      ["7. Service availability", ["We work to keep Havn running smoothly, but the service is provided on an \"as is\" and \"as available\" basis. We may add, change, or remove features, and we cannot guarantee the service will always be uninterrupted or error-free."]],
      ["8. Suspension and termination", ["You can stop using Havn and delete your account at any time. We may suspend or close an account that breaks these terms or puts other people or the service at risk."]],
      ["9. Disclaimers and liability", ["To the extent the law allows, Havn is provided without warranties of any kind, and we are not liable for indirect or incidental losses arising from your use of the service. Nothing in these terms limits rights that cannot be limited under the law that applies to you."]],
      ["10. Changes to these terms", ["We may update these terms from time to time. When we do, we will change the date at the top of this page, and continuing to use Havn after a change means you accept the updated terms."]],
      ["11. Contact us", ["Questions about these terms? Reach us at support@havn.app."]],
    ],
  },
  privacy: {
    title: "Privacy Policy",
    updated: "September 4, 2026",
    intro: "Havn is built to be a quiet, private place to talk. This policy explains what we collect, why, and the choices you have. We keep it in plain language on purpose.",
    sections: [
      ["1. Who we are", ["Havn is a private messaging service that lets you exchange messages, voice notes, photos, videos, and calls with the people you choose. When this policy says \"we\" or \"Havn\", it means the team that operates the service."]],
      ["2. Information we collect", ["We only collect what we need to run Havn:", "Account details — your email address, display name, unique handle, and a securely hashed password. We never store your password in a readable form.", "Your content — the messages, voice notes, photos, videos, and stories you send, kept so we can deliver them to your conversations.", "Technical basics — limited device and connection information needed to keep the service secure and working, and the notification subscription your device creates if you turn on push notifications."]],
      ["3. How we use your information", ["Your information is used to operate the service, and nothing more:", "To deliver your messages, calls, and media to the right people.", "To verify your account and keep it secure from abuse.", "To send notifications you have asked for, on the devices you enabled them on.", "To provide support and respond to problems you report."]],
      ["4. What we never do", ["We do not sell your data. We do not show you ads. We do not track you across other websites or build an advertising profile of you, and we do not read your conversations to target you. Havn is a space that works for you, not for advertisers."]],
      ["5. Service providers", ["Running a messaging service takes a few trusted partners. They only ever receive the information needed to do their specific job, and they are not permitted to use it for anything else:", "Cloud media storage, to hold the photos, videos, and voice notes you send.", "An email provider, to send verification codes and account emails.", "Push notification services operated by your device or browser maker, to deliver alerts.", "Security and abuse-prevention tooling, to keep the service safe."]],
      ["6. Data retention", ["We keep your information for as long as your account is active. When you delete a message it is removed, and when you delete your account we remove your personal data, except where we are required to keep certain records to meet a legal obligation or to resolve a dispute."]],
      ["7. Your rights and choices", ["You are in control of your data. You can edit your profile, delete messages, manage which devices receive notifications, and delete your account at any time. If you would like a copy of your data or have a request about it, contact us and we will help."]],
      ["8. Security", ["Connections to Havn are encrypted in transit, passwords are stored only as secure hashes, and access to systems is limited to what is necessary to operate them. No online service can promise perfect security, but protecting your conversations is a first-order priority, not an afterthought."]],
      ["9. Children", ["Havn is not intended for children under 13, and we do not knowingly collect information from them. If you believe a child has created an account, please contact us so we can remove it."]],
      ["10. Changes to this policy", ["We may update this policy as Havn grows. When we do, we will change the date at the top of this page, and for significant changes we will let you know in the app."]],
      ["11. Contact us", ["Questions about your privacy? Reach us at privacy@havn.app."]],
    ],
  },
};

export default function LegalDocument() {
  const { doc } = useLocalSearchParams();
  const router = useRouter();
  const theme = useTheme();
  const content = documents[String(doc)] || documents.terms;
  return <AppScreen><ScrollView contentContainerStyle={styles.content}><View style={styles.header}><Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}><Icon name="back" color={theme.text} /></Pressable><Text allowFontScaling style={[styles.title, { color: theme.text }]}>{content.title}</Text></View><View style={[styles.intro, { backgroundColor: theme.surface }]}><Text style={{ color: theme.muted, fontSize: 12 }}>Last updated {content.updated}</Text><Text style={[styles.copy, { color: theme.text }]}>{content.intro}</Text></View>{content.sections.map(([heading, paragraphs]) => <View key={heading} style={styles.section}><Text style={[styles.sectionTitle, { color: theme.text }]}>{heading}</Text>{paragraphs.map((paragraph, index) => <Text key={`${heading}-${index}`} style={[styles.copy, { color: theme.text }]}>{paragraphs.length > 1 && index > 0 ? `•  ${paragraph}` : paragraph}</Text>)}</View>)}</ScrollView></AppScreen>;
}

const styles = StyleSheet.create({ content: { padding: 17, paddingBottom: 35 }, header: { minHeight: 50, flexDirection: "row", alignItems: "center", marginBottom: 12 }, back: { width: 44, height: 44, justifyContent: "center" }, title: { flex: 1, fontSize: 21, fontWeight: "800" }, intro: { padding: 15, borderRadius: 16, marginBottom: 18 }, section: { marginBottom: 18 }, sectionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 6 }, copy: { fontSize: 14, lineHeight: 21, marginTop: 5 } });
