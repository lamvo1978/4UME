import { Button, Checkbox, Group, Modal, Stack, Textarea, TextInput } from "@mantine/core";
import { useEffect, useState } from "react";
import { FEATURES, type AdminPartner, type SavePartner } from "../api";

export function PartnerFormModal({
  opened,
  partner,
  saving,
  onClose,
  onSave,
}: {
  opened: boolean;
  partner: AdminPartner | null;
  saving: boolean;
  onClose: () => void;
  onSave: (p: SavePartner) => void;
}) {
  const [form, setForm] = useState<SavePartner>({ name: "", features: ["ielts"], note: null });

  useEffect(() => {
    if (opened) setForm(partner ? { name: partner.name, features: partner.features, note: partner.note } : { name: "", features: ["ielts"], note: null });
  }, [opened, partner]);

  return (
    <Modal opened={opened} onClose={onClose} title={partner ? "Sửa đối tác" : "Thêm đối tác"} centered>
      <Stack>
        <TextInput
          label="Tên đối tác"
          description="Học viên thấy tên này trong app, ví dụ “Trung tâm ABC IELTS”."
          maxLength={80}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.currentTarget.value })}
          data-autofocus
        />
        <Checkbox.Group
          label="Mở tính năng ẩn"
          description="Học viên của đối tác luôn có Premium; chọn thêm tính năng riêng nếu có."
          value={form.features}
          onChange={(features) => setForm({ ...form, features })}
        >
          <Group mt="xs">
            {FEATURES.map((f) => (
              <Checkbox key={f.value} value={f.value} label={f.label} />
            ))}
          </Group>
        </Checkbox.Group>
        <Textarea
          label="Ghi chú"
          description="Chỉ quản trị viên thấy: người liên hệ, thoả thuận…"
          autosize
          minRows={2}
          maxLength={500}
          value={form.note ?? ""}
          onChange={(e) => setForm({ ...form, note: e.currentTarget.value || null })}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Huỷ
          </Button>
          <Button loading={saving} disabled={!form.name.trim()} onClick={() => onSave(form)}>
            {partner ? "Lưu" : "Thêm"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
