import { Button, Descriptions, Empty, Space, Table, Typography, type TableProps } from 'antd';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useLms } from '../../store';
import { PageTitle, StatusTag } from '../../components/common';
import { formatPrice } from '../../data';
import { orderChannelLabel } from '../../lib/access-code-utils';
import type { Order } from '../../types';

const { Text } = Typography;
export function OrdersPage() {
  const { data, currentUser } = useLms();
  const currentUserId = currentUser?.id ?? '';
  const orders = data.orders.filter((order) => order.userId === currentUserId);

  const columns: TableProps<Order>['columns'] = [
    {
      title: 'คอร์ส',
      render: (_, order) =>
        data.courses.find((course) => course.id === order.courseId)?.title ?? 'คอร์สที่ถูกลบ',
    },
    {
      title: 'ยอดรวม',
      dataIndex: 'amount',
      render: (amount: number) => formatPrice(amount),
    },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      render: (status: Order['status']) => <StatusTag status={status} />,
    },
    {
      title: 'วันที่',
      dataIndex: 'createdAt',
      render: (value: string) => new Date(value).toLocaleDateString('th-TH'),
    },
    {
      title: '',
      render: (_, order) => (
        <Link to={`/account/orders/${order.id}`}>
          <Button>รายละเอียด</Button>
        </Link>
      ),
    },
  ];

  return (
    <>
      <PageTitle
        eyebrow="บัญชี"
        title="รายการสั่งซื้อ"
        subtitle="ตรวจสอบสถานะการซื้อและเปิดรายการแต่ละครั้ง"
      />
      <Table<Order>
        rowKey="id"
        dataSource={orders}
        columns={columns}
        pagination={{ pageSize: 8 }}
        locale={{ emptyText: 'ยังไม่มีรายการสั่งซื้อ' }}
      />
    </>
  );
}

export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const location = useLocation();
  const { data, currentUser } = useLms();
  const currentUserId = currentUser?.id ?? '';
  const isAdminView =
    currentUser?.role === 'admin' && location.pathname.startsWith('/admin/orders/');
  const order = data.orders.find((item) => item.id === orderId);

  if (!order || (!isAdminView && order.userId !== currentUserId)) {
    return <Empty description="ไม่พบรายการนี้" />;
  }

  const course = data.courses.find((item) => item.id === order.courseId);
  const user = data.users.find((item) => item.id === order.userId);
  const requestedReturn = new URLSearchParams(location.search).get('returnTo');
  const back = isAdminView
    ? /^\/admin\/orders(?:\?|$)/.test(requestedReturn || '')
      ? requestedReturn!
      : '/admin/orders'
    : '/account/orders';

  return (
    <>
      <PageTitle
        eyebrow="รายการสั่งซื้อ"
        title="รายละเอียดและใบเสร็จจำลอง"
        actions={
          <Space>
            <Link to={back}>
              <Button>กลับรายการซื้อ</Button>
            </Link>
            <Button onClick={() => window.print()}>พิมพ์ใบเสร็จ</Button>
          </Space>
        }
      />
      <Descriptions bordered column={1} className="order-details">
        <Descriptions.Item label="เลขรายการ">{order.id}</Descriptions.Item>
        {isAdminView && (
          <Descriptions.Item label="ผู้สั่งซื้อ">
            {user?.name || order.userId} · {user?.email || '—'}
          </Descriptions.Item>
        )}
        <Descriptions.Item label="คอร์ส">
          {course?.title ?? 'คอร์สที่ถูกลบ'}
        </Descriptions.Item>
        <Descriptions.Item label="ช่องทางขาย">{orderChannelLabel(order)}</Descriptions.Item>
        <Descriptions.Item label="ราคาเต็ม">{formatPrice(order.listPrice ?? course?.price ?? order.amount)}</Descriptions.Item>
        <Descriptions.Item label="ส่วนลด">{formatPrice(order.discountAmount ?? 0)}</Descriptions.Item>
        {order.accessCode && <Descriptions.Item label="โค้ดที่ใช้">{order.accessCode}</Descriptions.Item>}
        <Descriptions.Item label="ยอดรับจริง">{formatPrice(order.amount)}</Descriptions.Item>
        <Descriptions.Item label="วิธีชำระ">{order.method}</Descriptions.Item>
        {isAdminView && order.status === 'paid' && <>
          <Descriptions.Item label="ส่วนแบ่งผู้สอน">{formatPrice(order.instructorShareAmount ?? 0)} ({order.instructorSharePercent ?? 0}%)</Descriptions.Item>
          <Descriptions.Item label="ส่วนแบ่งแพลตฟอร์ม">{formatPrice(order.platformShareAmount ?? 0)}</Descriptions.Item>
        </>}
        <Descriptions.Item label="สถานะ">
          <StatusTag status={order.status} />
        </Descriptions.Item>
        <Descriptions.Item label="วันที่">
          {new Date(order.createdAt).toLocaleString('th-TH')}
        </Descriptions.Item>
      </Descriptions>
      <Text type="secondary">เอกสารนี้เป็นใบเสร็จตัวอย่างสำหรับทบทวนหน้าจอ ไม่มีผลทางบัญชี</Text>
    </>
  );
}
