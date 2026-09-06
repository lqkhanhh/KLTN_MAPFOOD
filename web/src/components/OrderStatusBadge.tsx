const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  PENDING: { label: 'Chờ xác nhận', bg: '#FEF3C7', color: '#92400E' },
  CONFIRMED: { label: 'Đã xác nhận', bg: 'var(--color-primary-soft)', color: 'var(--color-accent-dark)' },
  PREPARING: { label: 'Đang chuẩn bị', bg: 'var(--color-primary-soft)', color: 'var(--color-accent-dark)' },
  READY: { label: 'Sẵn sàng lấy', bg: 'rgba(60,140,94,.15)', color: 'var(--color-success)' },
  COMPLETED: { label: 'Hoàn thành', bg: '#E5E7EB', color: '#4B5563' },
  CANCELLED: { label: 'Đã hủy', bg: 'rgba(179,38,30,.1)', color: 'var(--color-danger)' },
};

export function OrderStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[String(status).toUpperCase()] ?? {
    label: 'Chưa xác định', bg: '#E5E7EB', color: '#374151',
  };
  return <span className="rb-order-status" style={{ backgroundColor: config.bg, color: config.color }}>{config.label}</span>;
}
