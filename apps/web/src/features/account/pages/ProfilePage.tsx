import React from 'react';
import { Button, Popconfirm, message } from 'antd';
import { useLms } from '@melearn/store';
import { ProfileSettings } from '../components/ProfileSettings';

export function ProfilePage() {
  const { currentUser, data, updateProfile, resetDemo } = useLms();

  if (!currentUser) return null;

  return (
    <>
      <ProfileSettings key={currentUser.id} user={currentUser} users={data.users} updateProfile={updateProfile} />
      <details className="demo-reset-settings">
        <summary>เครื่องมือสำหรับทดลองระบบ</summary>
        <p>เริ่มข้อมูลตัวอย่างใหม่ โดยล้างการแก้ไขและรายการที่สร้างไว้ในเบราว์เซอร์นี้</p>
        <Popconfirm
          title="เริ่มข้อมูลตัวอย่างใหม่?"
          description="ข้อมูลที่คุณแก้ไขในเบราว์เซอร์นี้จะถูกล้าง"
          okText="เริ่มใหม่"
          cancelText="ยกเลิก"
          onConfirm={() => {
            resetDemo();
            message.success('ตั้งค่าข้อมูลตัวอย่างใหม่แล้ว');
          }}
        >
          <Button danger>เริ่มข้อมูลตัวอย่างใหม่</Button>
        </Popconfirm>
      </details>
    </>
  );
}
