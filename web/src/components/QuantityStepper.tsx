interface QuantityStepperProps {
  quantity: number;
  onIncrease: () => void;
  onDecrease: () => void;
  name?: string;
  disabled?: boolean;
}

export function QuantityStepper({ quantity, onIncrease, onDecrease, name = 'món', disabled = false }: QuantityStepperProps) {
  if (quantity <= 0) {
    return <button type="button" className="rb-quantity-add" aria-label={`Thêm ${name}`} onClick={onIncrease} disabled={disabled}>+</button>;
  }
  return <div className="rb-quantity-stepper" role="group" aria-label={`Số lượng ${name}`}>
    <button type="button" aria-label={`Giảm ${name}`} onClick={onDecrease} disabled={disabled}>−</button>
    <span aria-live="polite" aria-atomic="true">{quantity}</span>
    <button type="button" className="rb-quantity-increase" aria-label={`Tăng ${name}`} onClick={onIncrease} disabled={disabled || quantity >= 100}>+</button>
  </div>;
}
