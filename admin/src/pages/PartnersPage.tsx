import { Alert, Badge, Button, Card, Group, SimpleGrid, Skeleton, Stack, Text, Title } from "@mantine/core";
import { IconBuildingCommunity, IconPlus } from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, featureLabel, type SavePartner } from "../api";
import { notifyError, notifySaved } from "../lib";
import { PartnerFormModal } from "../partners/PartnerFormModal";

export function PartnersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["partners"], queryFn: api.partners });
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  async function create(p: SavePartner) {
    setSaving(true);
    try {
      const created = await api.createPartner(p);
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      notifySaved("Đã thêm đối tác");
      navigate(`/partners/${created.partner.id}`);
    } catch (e) {
      notifyError(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack gap="md" maw={1000}>
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={2}>Đối tác</Title>
          <Text c="dimmed" fz="sm" maw={640}>
            Trung tâm có mã riêng cho học viên. Mỗi mã dùng một lần; người nhập mã có Premium và tính năng của đối tác đến hết hạn lô mã
            hoặc khi bạn thu hồi. Premium riêng của học viên (nếu có) được tạm dừng và tiếp tục sau đó.
          </Text>
        </div>
        <Button leftSection={<IconPlus size={18} />} onClick={() => setCreating(true)}>
          Thêm đối tác
        </Button>
      </Group>

      {query.error ? <Alert color="red">{(query.error as Error).message}</Alert> : null}
      {query.isLoading ? <Skeleton h={120} radius="lg" /> : null}
      {query.data?.length === 0 ? (
        <Card p="xl" radius="lg" shadow="xs">
          <Stack align="center" gap="xs">
            <IconBuildingCommunity size={36} stroke={1.5} />
            <Text c="dimmed">Chưa có đối tác nào.</Text>
          </Stack>
        </Card>
      ) : null}

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        {query.data?.map((p) => (
          <Card key={p.id} p="md" radius="lg" shadow="xs" style={{ cursor: "pointer" }} onClick={() => navigate(`/partners/${p.id}`)}>
            <Group justify="space-between" wrap="nowrap" align="flex-start">
              <Group gap="xs" wrap="nowrap">
                <Badge variant="outline" color="gray" ff="monospace">
                  {p.prefix}
                </Badge>
                <Text fw={700} lineClamp={2}>
                  {p.name}
                </Text>
              </Group>
              <Group gap={4}>
                {p.features.map((f) => (
                  <Badge key={f} variant="light" color="grape">
                    {featureLabel(f)}
                  </Badge>
                ))}
              </Group>
            </Group>
            <Group gap="lg" mt="sm">
              <Stat value={p.students} label="học viên" />
              <Stat value={p.unused} label="mã chưa dùng" />
              {p.monthUnits > 0 ? <Stat value={p.monthUnits} label="tháng phí tháng này" /> : null}
            </Group>
          </Card>
        ))}
      </SimpleGrid>

      <PartnerFormModal opened={creating} partner={null} saving={saving} onClose={() => setCreating(false)} onSave={create} />
    </Stack>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <Text fz="sm" c="dimmed">
      <Text span fw={700} c="var(--mantine-color-text)" fz="lg">
        {value.toLocaleString("vi-VN")}
      </Text>{" "}
      {label}
    </Text>
  );
}
