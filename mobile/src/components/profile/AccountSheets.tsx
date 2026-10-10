import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { FormSheet, SheetInput } from "./FormSheet";

const MIN_PASSWORD = 6;

export function NameSheet({ visible, current, onClose }: { visible: boolean; current: string; onClose: () => void }) {
  const { updateSettings } = useAuth();
  const [value, setValue] = useState(current);
  useEffect(() => {
    if (visible) setValue(current);
  }, [visible, current]);
  return (
    <FormSheet
      visible={visible}
      title="Đổi tên hiển thị"
      submitLabel="Lưu"
      canSubmit={value.trim().length > 0 && value.trim() !== current}
      onClose={onClose}
      onSubmit={async () => {
        await updateSettings({ displayName: value.trim() });
        onClose();
      }}
    >
      <SheetInput label="Tên" value={value} onChangeText={setValue} autoFocus maxLength={60} />
    </FormSheet>
  );
}

export function PasswordSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const close = () => {
    setCurrent("");
    setNext("");
    onClose();
  };
  return (
    <FormSheet
      visible={visible}
      title="Đổi mật khẩu"
      submitLabel="Đổi mật khẩu"
      canSubmit={current.length > 0 && next.length >= MIN_PASSWORD}
      onClose={close}
      onSubmit={async () => {
        await api.changePassword(current, next);
        close();
        Alert.alert("Đã đổi mật khẩu", "Lần đăng nhập sau hãy dùng mật khẩu mới.");
      }}
    >
      <SheetInput label="Mật khẩu hiện tại" value={current} onChangeText={setCurrent} secureTextEntry autoFocus />
      <SheetInput
        label={`Mật khẩu mới (tối thiểu ${MIN_PASSWORD} ký tự)`}
        value={next}
        onChangeText={setNext}
        secureTextEntry
      />
    </FormSheet>
  );
}

export function DeleteSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { logout } = useAuth();
  const [password, setPassword] = useState("");
  const close = () => {
    setPassword("");
    onClose();
  };
  return (
    <FormSheet
      visible={visible}
      title="Xoá tài khoản"
      description="Toàn bộ tiến trình học, chuỗi ngày học và cài đặt sẽ bị xoá vĩnh viễn, không thể khôi phục."
      submitLabel="Xoá vĩnh viễn"
      danger
      canSubmit={password.length > 0}
      onClose={close}
      onSubmit={async () => {
        await api.deleteAccount(password);
        close();
        await logout();
      }}
    >
      <SheetInput label="Nhập mật khẩu để xác nhận" value={password} onChangeText={setPassword} secureTextEntry autoFocus />
    </FormSheet>
  );
}
