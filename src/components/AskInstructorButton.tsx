import React from 'react';
import { Button } from 'antd';
import { MessageOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { useLms } from '../store';
import { getInboxContacts } from '../api/inbox';
import type { Chapter, Course, CourseItem } from '../types';

export interface AskInstructorButtonProps {
  course?: Course | null;
  item?: CourseItem | null;
  chapter?: Chapter | null;
  block?: boolean;
}

export function AskInstructorButton({ course, item, chapter, block = false }: AskInstructorButtonProps) {
  const { data, currentUser } = useLms();
  const contact = getInboxContacts(data, currentUser).find((entry) => entry.course?.id === course?.id);
  if (!contact || !course) return null;
  const search = new URLSearchParams({ recipient: contact.user.id, course: course.id });
  if (item) search.set('item', item.id);
  if (chapter) search.set('chapter', chapter.id);
  return (
    <Link to={`/learn/inbox?${search}`}>
      <Button block={block} icon={<MessageOutlined aria-hidden="true" />}>
        ถามผู้สอนผ่านอินบ็อกซ์
      </Button>
    </Link>
  );
}
