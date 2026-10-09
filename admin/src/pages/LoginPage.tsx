import {
  Alert,
  Anchor,
  Button,
  Center,
  Group,
  Paper,
  PasswordInput,
  PinInput,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { ACCENT, BG } from "../theme";

const CODE_LENGTH = 6;

export function LoginPage() {
  const { login } = useAuth();
  const [forgot, setForgot] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng nhập thất bại");
    } finally {
      setBusy(false);
    }
  }

  if (forgot) {
    return (
      <Shell subtitle="Đặt lại mật khẩu bằng mã gửi qua email">
        <ForgotPassword initialEmail={email} onBack={() => setForgot(false)} />
      </Shell>
    );
  }

  return (
    <Shell subtitle="Đăng nhập bằng tài khoản 4UME có quyền quản trị" onSubmit={submit}>
      {error ? <Alert color="red">{error}</Alert> : null}
      <TextInput
        label="Email"
        type="email"
        autoComplete="username"
        required
        value={email}
        onChange={(e) => setEmail(e.currentTarget.value)}
      />
      <Stack gap={6}>
        <PasswordInput
          label="Mật khẩu"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
        />
        <Anchor component="button" type="button" fz="sm" ta="right" c={ACCENT} onClick={() => setForgot(true)}>
          Quên mật khẩu?
        </Anchor>
      </Stack>
      <Button type="submit" loading={busy} fullWidth>
        Đăng nhập
      </Button>
    </Shell>
  );
}

function Shell({ subtitle, onSubmit, children }: { subtitle: string; onSubmit?: (e: FormEvent) => void; children: ReactNode }) {
  return (
    <Center mih="100dvh" p="md" bg={BG}>
      <Paper component="form" onSubmit={onSubmit} w="100%" maw={400} p="xl" radius="lg" shadow="sm">
        <Stack>
          <Stack gap={4} align="center">
            <img src="/logo-emblem.png" alt="" width={44} height={68} style={{ objectFit: "contain" }} />
            <Title order={2} c={ACCENT}>
              4UME Admin
            </Title>
            <Text c="dimmed" fz="sm" ta="center">
              {subtitle}
            </Text>
          </Stack>
          {children}
        </Stack>
      </Paper>
    </Center>
  );
}

function ForgotPassword({ initialEmail, onBack }: { initialEmail: string; onBack: () => void }) {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  /** Seconds until "Gửi lại mã" is allowed; null until the first code is sent. */
  const [wait, setWait] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!wait) return;
    const timer = setTimeout(() => setWait((s) => (s ? s - 1 : 0)), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  async function sendCode() {
    setBusy(true);
    setError("");
    try {
      const result = await api.sendResetCode(email.trim());
      setWait(result.resendAfterSeconds);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không gửi được mã");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (password.length < 6) {
      setError("Mật khẩu mới cần tối thiểu 6 ký tự.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await resetPassword(email.trim(), code, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không đặt lại được mật khẩu");
    } finally {
      setBusy(false);
    }
  }

  if (wait === null) {
    return (
      <>
        {error ? <Alert color="red">{error}</Alert> : null}
        <TextInput
          label="Email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              sendCode();
            }
          }}
        />
        <Button onClick={sendCode} loading={busy} disabled={!email.trim()} fullWidth>
          Gửi mã
        </Button>
        <Anchor component="button" type="button" fz="sm" c={ACCENT} onClick={onBack}>
          Quay lại đăng nhập
        </Anchor>
      </>
    );
  }

  return (
    <>
      <Text fz="sm">
        Mã 6 số đã được gửi tới <b>{email.trim()}</b>. Nếu không thấy, hãy xem cả mục Spam.
      </Text>
      {error ? <Alert color="red">{error}</Alert> : null}
      <Stack gap={6} align="center">
        <PinInput length={CODE_LENGTH} type="number" oneTimeCode autoFocus value={code} onChange={setCode} size="md" />
        <Anchor component="button" type="button" fz="sm" c={wait > 0 ? "dimmed" : ACCENT} disabled={wait > 0 || busy} onClick={sendCode}>
          {wait > 0 ? `Gửi lại mã sau ${wait} giây` : "Không nhận được? Gửi lại mã"}
        </Anchor>
      </Stack>
      <PasswordInput
        label="Mật khẩu mới"
        description="Tối thiểu 6 ký tự"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.currentTarget.value)}
      />
      <Button onClick={submit} loading={busy} disabled={code.length < CODE_LENGTH || !password} fullWidth>
        Đặt lại và đăng nhập
      </Button>
      <Group justify="space-between">
        <Anchor component="button" type="button" fz="sm" c={ACCENT} onClick={() => setWait(null)}>
          Đổi email
        </Anchor>
        <Anchor component="button" type="button" fz="sm" c={ACCENT} onClick={onBack}>
          Quay lại đăng nhập
        </Anchor>
      </Group>
    </>
  );
}
