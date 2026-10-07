import React from 'react';
import { ActionIcon, Indicator, Menu, ScrollArea, Text } from '@mantine/core';
import { IconBell, IconCircleFilled } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { getNotificationTarget } from '../lib/notification-targets';
import { useLms } from '../store';
import './workspace-notifications.css';

export function WorkspaceNotifications() {
  const { data, currentUser, markNotificationRead } = useLms();
  const navigate = useNavigate();
  const entries = (data.notifications || []).flatMap((entry) => {
    if (entry.userId !== currentUser?.id) return [];
    const target = getNotificationTarget(entry, currentUser, data.courses, data.attempts);
    return target ? [{ entry, target }] : [];
  });
  const unreadCount = entries.filter(({ entry }) => !entry.readAt).length;
  return (
    <Menu position="bottom-end" withinPortal shadow="md" width={340}>
      <Menu.Target>
        <ActionIcon
          variant="subtle"
          color="gray"
          size={42}
          aria-label={`แจ้งเตือน${unreadCount ? ` มี ${unreadCount} รายการที่ยังไม่อ่าน` : ''}`}
        >
          <Indicator disabled={!unreadCount} label={unreadCount > 99 ? '99+' : unreadCount} size={17} color="cobalt" offset={2}>
            <IconBell size={21} aria-hidden="true" />
          </Indicator>
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown className="workspace-notifications">
        <Menu.Label>แจ้งเตือน{unreadCount ? ` · ยังไม่อ่าน ${unreadCount}` : ''}</Menu.Label>
        {entries.length ? (
          <ScrollArea.Autosize mah={380}>
            {entries.map(({ entry, target }) => (
              <Menu.Item
                key={entry.id}
                className="workspace-notification-item"
                onClick={() => {
                  markNotificationRead(entry.id);
                  navigate(target);
                }}
                leftSection={
                  !entry.readAt ? (
                    <IconCircleFilled size={7} color="var(--primary)" aria-hidden="true" />
                  ) : (
                    <span className="notification-read-spacer" />
                  )
                }
              >
                <strong>{entry.title}</strong>
                <span>{entry.description}</span>
                <small>{entry.createdAt ? new Date(entry.createdAt).toLocaleString('th-TH') : ''}</small>
              </Menu.Item>
            ))}
          </ScrollArea.Autosize>
        ) : (
          <Text className="notification-empty" size="sm" c="dimmed">
            ยังไม่มีการแจ้งเตือน
          </Text>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}
