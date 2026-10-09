import { Drawer } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { HistoryList } from "./HistoryList";

type Props = {
  opened: boolean;
  onClose: () => void;
  entityType: string;
  entityId: string;
  title: string;
  onRestored?: () => void;
};

/** Change history of one word / deck / lesson, opened from its edit page. */
export function HistoryDrawer({ opened, onClose, entityType, entityId, title, onRestored }: Props) {
  const desktop = useMediaQuery("(min-width: 64em)", true);
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={`Lịch sử · ${title}`}
      position={desktop ? "right" : "bottom"}
      size={desktop ? 520 : "85%"}
      styles={{ title: { fontWeight: 700 }, body: { background: "#F4F8F6", minHeight: "100%" } }}
    >
      {opened ? <HistoryList entityType={entityType} entityId={entityId} onRestored={onRestored} /> : null}
    </Drawer>
  );
}
