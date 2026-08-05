import { AuthForm } from "../components/AuthForm";

export default function SignInPage() {
  const googleEnabled = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );
  return <AuthForm mode="sign-in" googleEnabled={googleEnabled} />;
}
