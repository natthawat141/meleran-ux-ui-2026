import React from 'react';
import { Button, Descriptions, Table, Tag, Typography } from 'antd';
import type { TableProps } from 'antd';
import { Link } from 'react-router-dom';
import { useLms } from '../../store';
import { PageTitle, StatusTag } from '../../components/common';
import { DirectorySearch, matchesDirectorySearch, useDirectorySearch } from '../../components/DirectorySearch';
import { formatPrice } from '../../data';
import { orderChannelLabel } from '../../lib/access-code-utils';
import type { Order, Course, User } from '../../types';

interface EnrichedOrder extends Order {
  user?: User;
  course?: Course;
}

const statuses = [
  { value: 'all', label: 'ทุกสถานะ' },
  { value: 'paid', label: 'ชำระแล้ว' },
  { value: 'failed', label: 'ชำระไม่สำเร็จ' },
  { value: 'pending', label: 'รอชำระ' },
];

export function AdminOrdersPage() {
  const { data } = useLms();
  const paidOrders = data.orders.filter((order) => order.status === 'paid');
  const channelTotal = (channel: string) => paidOrders.filter((order) => orderChannelLabel(order) === channel).reduce((sum, order) => sum + Number(order.amount || 0), 0);
  const { query, filter, params, setQuery, setFilter } = useDirectorySearch('status', statuses);
  const orders: EnrichedOrder[] = data.orders
    .map((order) => ({
      ...order,
      user: data.users.find((entry) => entry.id === order.userId),
      course: data.courses.find((entry) => entry.id === order.courseId),
    }))
    .filter(
      (order) =>
        (filter === 'all' || order.status === filter) &&
        matchesDirectorySearch(query, [
          order.id,
          order.userId,
          order.user?.name,
          order.user?.email,
          order.course?.title,
          order.courseId,
          order.method,
          order.accessCode,
          order.source,
          order.status,
          statuses.find((entry) => entry.value === order.status)?.label,
          order.amount,
          order.createdAt,
          new Date(order.createdAt).toLocaleDateString('th-TH'),
        ])
    );
  const returnTo = `/admin/orders${params.size ? `?${params}` : ''}`;

  const columns: TableProps<EnrichedOrder>['columns'] = [
    {
      title: 'ผู้สั่งซื้อ',
      render: (_, order) => (
        <div className="table-course-name">
          <Link to={`/admin/users/${order.userId}`}>{order.user?.name || 'ไม่พบบัญชี'}</Link>
          <Typography.Text type="secondary">{order.user?.email || order.userId}</Typography.Text>
        </div>
      ),
    },
    {
      title: 'เลขรายการ / คอร์ส',
      render: (_, order) => (
        <div className="table-course-name">
          <strong>{order.id}</strong>
          <Typography.Text type="secondary">{order.course?.title || 'คอร์สที่ถูกลบ'}</Typography.Text>
        </div>
      ),
    },
    { title: 'ช่องทาง', render: (_, order) => <Tag color={order.source === 'cash_code' ? 'blue' : order.source === 'free_code' ? 'default' : 'cyan'}>{orderChannelLabel(order)}</Tag> },
    { title: 'ราคาเต็ม', render: (_, order) => formatPrice(order.listPrice ?? order.amount) },
    { title: 'ส่วนลด', render: (_, order) => formatPrice(order.discountAmount ?? 0) },
    { title: 'ยอดรับจริง', dataIndex: 'amount', render: (amt: number) => formatPrice(amt) },
    { title: 'วิธีชำระ/โค้ด', render: (_, order) => <div className="table-course-name"><span>{order.method || '—'}</span>{order.accessCode && <Typography.Text type="secondary">{order.accessCode}</Typography.Text>}</div> },
    { title: 'สถานะ', dataIndex: 'status', render: (status: string) => <StatusTag status={status} /> },
    { title: 'วันที่', dataIndex: 'createdAt', render: (value: string) => new Date(value).toLocaleDateString('th-TH') },
    {
      title: 'รายละเอียด',
      render: (_, order) => (
        <Link to={`/admin/orders/${order.id}?returnTo=${encodeURIComponent(returnTo)}`}>
          <Button>ดูรายการ</Button>
        </Link>
      ),
    },
  ];

  return (
    <>
      <PageTitle eyebrow="ผู้ดูแลระบบ" title="รายการสั่งซื้อทั้งหมด" subtitle="ค้นหาผู้สั่งซื้อ ตรวจยอดรับจริง และแยกช่องทางชำระผ่านระบบกับโค้ดเงินสด" />
      <Descriptions className="admin-order-channels" bordered size="small" column={{ xs: 1, sm: 3 }}>
        <Descriptions.Item label="ชำระผ่านระบบ">{formatPrice(channelTotal('ชำระผ่านระบบ'))}</Descriptions.Item>
        <Descriptions.Item label="เงินสดผ่านโค้ด">{formatPrice(channelTotal('เงินสดผ่านโค้ด'))}</Descriptions.Item>
        <Descriptions.Item label="โค้ดเรียนฟรี">{paidOrders.filter((order) => orderChannelLabel(order) === 'โค้ดเรียนฟรี').length} รายการ · {formatPrice(channelTotal('โค้ดเรียนฟรี'))}</Descriptions.Item>
      </Descriptions>
      <DirectorySearch
        query={query}
        onQuery={setQuery}
        placeholder="ค้นหาชื่อ อีเมล เลขรายการ คอร์ส หรือวิธีชำระ"
        filter={filter}
        onFilter={setFilter}
        filterLabel="สถานะการสั่งซื้อ"
        options={statuses}
        count={orders.length}
      />
      <Table
        key={`${query}:${filter}`}
        rowKey="id"
        columns={columns}
        dataSource={orders}
        scroll={{ x: 1250 }}
        pagination={{ pageSize: 8 }}
        locale={{ emptyText: data.orders.length ? 'ไม่พบรายการที่ตรงกับคำค้นและตัวกรอง' : 'ยังไม่มีรายการสั่งซื้อ' }}
      />
    </>
  );
}
