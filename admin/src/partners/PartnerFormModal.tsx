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
  const [form, setForm] = useState<SavePartner>({ name: "", prefix: "", features: ["ielts"], note: null });
  const prefixLocked = !!partner && partner.codes > 0;
  const prefixValid = /^[A-Z]{2}$/.test(form.prefix);

  useEffect(() => {
    if (opened)
      setForm(
        partner
          ? { name: partner.name, prefix: partner.prefix, features: partner.features, note: partner.note }
          : { name: "", prefix: "", features: ["ielts"], note: null },
      );
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
        <TextInput
          label="Tiền tố mã"
          description={
            prefixLocked
              ? "Đối tác đã có mã nên tiền tố được giữ cố định."
              : "2 chữ cái, không trùng đối tác khác. Mã sẽ có dạng AB-482913 (6 số ngẫu nhiên)."
          }
          w={200}
          maxLength={2}
          placeholder="AB"
          disabled={prefixLocked}
          value={form.prefix}
          error={form.prefix && !prefixValid ? "Cần đúng 2 chữ cái A–Z" : undefined}
          onChange={(e) => setForm({ ...form, prefix: e.currentTarget.value.toUpperCase().replace(/[^A-Z]/g, "") })}
          styles={{ input: { fontFamily: "monospace", letterSpacing: 2 } }}
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
          description="Chỉ quản trị viên thấy: người liên hệ, thoả thuận, giá theo tháng…"
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
          <Button loading={saving} disabled={!form.name.trim() || !prefixValid} onClick={() => onSave(form)}>
            {partner ? "Lưu" : "Thêm"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
