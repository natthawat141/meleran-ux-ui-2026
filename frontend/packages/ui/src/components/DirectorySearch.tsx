import React, { useEffect, useRef } from 'react';
import { Input, Select } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import './directory-search.css';

export function matchesDirectorySearch(query: string, values: unknown[]): boolean {
  const normalize = (value: unknown) => String(value ?? '').normalize('NFKC').toLocaleLowerCase();
  const haystack = values.map(normalize).join(' ');
  return normalize(query).trim().split(/\s+/).filter(Boolean).every((word) => haystack.includes(word));
}

export interface DirectoryFilterOption {
  value: string;
  label: React.ReactNode;
}

export function useDirectorySearch(filterKey: string, options: DirectoryFilterOption[]) {
  const [params, setParams] = useSearchParams();
  const latestParams = useRef(params);
  useEffect(() => {
    latestParams.current = params;
  }, [params]);
  const query = params.get('q') || '';
  const paramVal = params.get(filterKey);
  const filter = options.some((option) => option.value === paramVal) ? (paramVal || 'all') : 'all';
  const change = (key: string, value?: string) => {
    const next = new URLSearchParams(latestParams.current);
    if (value && !(key === filterKey && value === 'all')) next.set(key, value);
    else next.delete(key);
    latestParams.current = next;
    setParams(next, { replace: true });
  };
  return {
    query,
    filter,
    params,
    setQuery: (value: string) => change('q', value),
    setFilter: (value: string) => change(filterKey, value),
  };
}

export interface DirectorySearchProps {
  query: string;
  onQuery: (value: string) => void;
  placeholder?: string;
  filter: string;
  onFilter: (value: string) => void;
  filterLabel?: string;
  options: DirectoryFilterOption[];
  count: number;
}

export function DirectorySearch({
  query,
  onQuery,
  placeholder,
  filter,
  onFilter,
  filterLabel,
  options,
  count,
}: DirectorySearchProps) {
  return (
    <div className="directory-search">
      <Input
        aria-label="ค้นหารายการ"
        prefix={<SearchOutlined aria-hidden="true" />}
        placeholder={placeholder}
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        allowClear
      />
      <Select aria-label={filterLabel} value={filter} onChange={onFilter} options={options} />
      <span role="status">พบ {count} รายการ</span>
    </div>
  );
}
