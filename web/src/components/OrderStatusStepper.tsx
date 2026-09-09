export const ORDER_STEPS = [
  { status: 'PENDING', label: 'Chờ xác nhận' },
  { status: 'CONFIRMED', label: 'Đã xác nhận' },
  { status: 'PREPARING', label: 'Đang chuẩn bị' },
  { status: 'READY', label: 'Sẵn sàng' },
  { status: 'COMPLETED', label: 'Hoàn thành' },
];

export function OrderStatusStepper({ currentStatus }: { currentStatus: string }) {
  const status = String(currentStatus || '').toUpperCase();
  const currentIndex = ORDER_STEPS.findIndex((step) => step.status === status);
  if (status === 'CANCELLED') return <div className="rb-order-cancelled" aria-live="polite">Đơn hàng đã bị hủy</div>;
  if (currentIndex < 0) return <p className="rb-stepper-unknown" aria-live="polite">Chưa xác định trạng thái đơn hàng.</p>;
  return <ol className="rb-order-stepper" aria-label="Tiến độ đơn hàng" aria-live="polite">
    {ORDER_STEPS.map((step, index) => <li key={step.status}
      className={index === currentIndex ? 'current' : index < currentIndex ? 'done' : 'upcoming'}
      aria-current={index === currentIndex ? 'step' : undefined}>
      <span className="rb-step-dot" aria-hidden="true">{index < currentIndex ? '✓' : index + 1}</span>
      <span className="rb-step-label">{step.label}</span>
    </li>)}
  </ol>;
}
