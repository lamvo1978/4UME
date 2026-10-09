import { Alert, Button, Group, Modal, PasswordInput, SegmentedControl, Stack, Text, TextInput } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type AdminUser, type AdminUserDetail } from "../api";
import { notifyError, notifySaved } from "../lib";

const MIN_PASSWORD = 6;
const EMPTY = { email: "", displayName: "", password: "", confirm: "", role: "admin" as AdminUser["role"] };

export function CreateUserModal({
  opened,
  onClose,
  onCreated,
}: {
  opened: boolean;
  onClose: () => void;
  onCreated: (d: AdminUserDetail) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) => setForm((f) => ({ ...f, [key]: value }));

  const errors = {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) ? null : "Email không hợp lệ",
    displayName: form.displayName.trim() ? null : "Nhập tên hiển thị",
    password: form.password.length >= MIN_PASSWORD ? null : `Tối thiểu ${MIN_PASSWORD} ký tự`,
    confirm: form.confirm === form.password ? null : "Mật khẩu nhập lại không khớp",
  };
  const valid = Object.values(errors).every((e) => !e);
  const show = (key: keyof typeof errors) => (touched ? errors[key] : null);

  function close() {
    setForm(EMPTY);
    setTouched(false);
    onClose();
  }

  async function submit() {
    setTouched(true);
    if (!valid) return;
    setBusy(true);
    try {
      const created = await api.createUser({
        email: form.email.trim(),
        displayName: form.displayName.trim(),
        password: form.password,
        role: form.role,
      });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      queryClient.invalidateQueries({ queryKey: ["audit"] });
      notifySaved(form.role === "admin" ? "Đã tạo tài khoản quản trị" : "Đã tạo tài khoản");
      close();
      onCreated(created);
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal opened={opened} onClose={close} title="Thêm tài khoản" centered>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Stack>
          <SegmentedControl
            fullWidth
            value={form.role}
            onChange={(v) => set("role", v as AdminUser["role"])}
            data={[
              { value: "admin", label: "Quản trị" },
              { value: "user", label: "Người học" },
            ]}
          />
          <TextInput
            label="Tên hiển thị"
            placeholder={form.role === "admin" ? "Ví dụ: Admin" : "Ví dụ: Minh Anh"}
            value={form.displayName}
            onChange={(e) => set("displayName", e.currentTarget.value)}
            error={show("displayName")}
            maxLength={60}
            data-autofocus
          />
          <TextInput
            label="Email đăng nhập"
            placeholder="admin@4ume.vn"
            value={form.email}
            onChange={(e) => set("email", e.currentTarget.value)}
            error={show("email")}
            autoComplete="off"
          />
          <PasswordInput
            label="Mật khẩu"
            value={form.password}
            onChange={(e) => set("password", e.currentTarget.value)}
            error={show("password")}
            autoComplete="new-password"
          />
          <PasswordInput
            label="Nhập lại mật khẩu"
            value={form.confirm}
            onChange={(e) => set("confirm", e.currentTarget.value)}
            error={show("confirm")}
            autoComplete="new-password"
          />
          <Alert variant="light" color={form.role === "admin" ? "orange" : "gray"} icon={<IconInfoCircle size={18} />}>
            <Text fz="sm">
              {form.role === "admin"
                ? "Tài khoản này đăng nhập được web admin và sửa được toàn bộ nội dung, người dùng, cài đặt. Đăng nhập rồi đổi mật khẩu ở góc tài khoản."
                : "Người học dùng email và mật khẩu này để đăng nhập app, không vào được web admin."}
            </Text>
          </Alert>
          <Group justify="flex-end">
            <Button variant="default" onClick={close}>
              Huỷ
            </Button>
            <Button type="submit" loading={busy} disabled={touched && !valid}>
              Tạo tài khoản
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
