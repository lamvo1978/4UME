import { Button, Group, Modal, PasswordInput, Stack } from "@mantine/core";
import { useState } from "react";
import { api } from "../api";
import { notifyError, notifySaved } from "../lib";

const MIN_PASSWORD = 6;
const EMPTY = { current: "", next: "", confirm: "" };

export function ChangePasswordModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const [form, setForm] = useState(EMPTY);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  const errors = {
    current: form.current ? null : "Nhập mật khẩu hiện tại",
    next: form.next.length >= MIN_PASSWORD ? null : `Tối thiểu ${MIN_PASSWORD} ký tự`,
    confirm: form.confirm === form.next ? null : "Mật khẩu nhập lại không khớp",
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
      await api.changePassword(form.current, form.next);
      notifySaved("Đã đổi mật khẩu");
      close();
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal opened={opened} onClose={close} title="Đổi mật khẩu" centered>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Stack>
          <PasswordInput
            label="Mật khẩu hiện tại"
            value={form.current}
            onChange={(e) => setForm({ ...form, current: e.currentTarget.value })}
            error={show("current")}
            autoComplete="current-password"
            data-autofocus
          />
          <PasswordInput
            label="Mật khẩu mới"
            value={form.next}
            onChange={(e) => setForm({ ...form, next: e.currentTarget.value })}
            error={show("next")}
            autoComplete="new-password"
          />
          <PasswordInput
            label="Nhập lại mật khẩu mới"
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.currentTarget.value })}
            error={show("confirm")}
            autoComplete="new-password"
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={close}>
              Huỷ
            </Button>
            <Button type="submit" loading={busy} disabled={touched && !valid}>
              Đổi mật khẩu
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
