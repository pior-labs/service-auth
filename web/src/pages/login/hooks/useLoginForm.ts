import { ChangeEvent, FormEvent, useCallback, useId, useState } from "react";
import { authClient } from "@/lib/auth-client";

export function useLoginForm() {
  const emailId = useId();
  const passwordId = useId();
  const errorId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onEmailChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setEmail(event.target.value);
  }, []);

  const onPasswordChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setPassword(event.target.value);
  }, []);

  const onTogglePassword = useCallback(() => {
    setShowPassword((value) => !value);
  }, []);

  const onSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);
      setLoading(true);

      const { error: signInError } = await authClient.signIn.email({
        email,
        password,
        rememberMe: true,
      });

      if (signInError) {
        setError(signInError.message || "The email or password was not accepted.");
        setLoading(false);
        return;
      }

      const { error: continueError } = await authClient.oauth2.continue({});
      if (continueError) {
        setError(continueError.message || "Signed in, but the OAuth flow could not continue.");
        setLoading(false);
        return;
      }

      // On success the OAuth flow redirects away; keep the loading state until then.
    },
    [email, password],
  );

  return {
    email,
    password,
    showPassword,
    loading,
    error,
    emailId,
    passwordId,
    errorId,
    onEmailChange,
    onPasswordChange,
    onTogglePassword,
    onSubmit,
  };
}
