import React from 'react';
import { Button, Table, Typography } from 'antd';
import type { TableProps } from 'antd';
import { Link } from 'react-router-dom';
import { useLms } from '../../store';
import { PageTitle, StatusTag } from '../../components/common';
import { DirectorySearch, matchesDirectorySearch, useDirectorySearch } from '../../components/DirectorySearch';
import { formatPrice } from '../../data';
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
    { title: 'ยอดรวม', dataIndex: 'amount', render: (amt: number) => formatPrice(amt) },
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
      <PageTitle eyebrow="ผู้ดูแลระบบ" title="รายการสั่งซื้อทั้งหมด" subtitle="ค้นหาผู้สั่งซื้อและตรวจสถานะการชำระเงินจำลอง" />
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
        scroll={{ x: 950 }}
        pagination={{ pageSize: 8 }}
        locale={{ emptyText: data.orders.length ? 'ไม่พบรายการที่ตรงกับคำค้นและตัวกรอง' : 'ยังไม่มีรายการสั่งซื้อ' }}
      />
    </>
  );
}
