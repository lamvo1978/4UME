import { Alert, Button, Center, Paper, PasswordInput, Stack, Text, TextInput, Title } from "@mantine/core";
import { useState, type FormEvent } from "react";
import { useAuth } from "../auth";
import { ACCENT, BG } from "../theme";

export function LoginPage() {
  const { login } = useAuth();
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

  return (
    <Center mih="100dvh" p="md" bg={BG}>
      <Paper component="form" onSubmit={submit} w="100%" maw={400} p="xl" radius="lg" shadow="sm">
        <Stack>
          <Stack gap={4} align="center">
            <img src="/logo-emblem.png" alt="" width={44} height={68} style={{ objectFit: "contain" }} />
            <Title order={2} c={ACCENT}>
              4UME Admin
            </Title>
            <Text c="dimmed" fz="sm">
              Đăng nhập bằng tài khoản 4UME có quyền quản trị
            </Text>
          </Stack>
          {error ? <Alert color="red">{error}</Alert> : null}
          <TextInput
            label="Email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
          />
          <PasswordInput
            label="Mật khẩu"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
          />
          <Button type="submit" loading={busy} fullWidth mt="xs">
            Đăng nhập
          </Button>
        </Stack>
      </Paper>
    </Center>
  );
}
