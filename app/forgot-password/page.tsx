import { ForgotPasswordForm } from "../components/ForgotPasswordForm";
import { isRecoveryEmailConfigured } from "../../lib/email";

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm enabled={isRecoveryEmailConfigured()} />;
}
