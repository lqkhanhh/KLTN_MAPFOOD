import { useEffect, useRef, useState, type FormEvent } from 'react';
import { request } from '../api';

interface ReviewModalProps {
  orderId: string;
  restaurantName: string;
  onClose: () => void;
  onSuccess: (review: any) => void;
  onAlreadyReviewed: (review: any) => void;
}

export function ReviewModal({ orderId, restaurantName, onClose, onSuccess, onAlreadyReviewed }: ReviewModalProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const sending = useRef(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (sending.current || alreadyReviewed) return;
    if (!rating) { setError('Vui lòng chọn số sao đánh giá.'); return; }
    sending.current = true; setSubmitting(true); setError('');
    try {
      // Backend lấy quán từ đơn hàng, không nhận restaurantId từ phía client.
      const review = await request('/reviews', { method: 'POST', body: { orderId, rating, comment: comment.trim() } });
      onSuccess(review); onClose();
    } catch (cause: any) {
      if (cause.status === 409) {
        // 409 cũng có thể là đơn chưa hoàn thành; chỉ đánh dấu khi API xác nhận đã có review.
        const order = await request(`/orders/${orderId}`).catch(() => null);
        if (order?.hasReview || order?.review) {
          setAlreadyReviewed(true); onAlreadyReviewed(order.review);
          setError('Bạn đã đánh giá đơn hàng này rồi.');
        } else setError(cause.message || 'Không thể đánh giá đơn hàng này.');
      } else setError(cause.status === 403 ? 'Bạn không thể đánh giá đơn hàng của người khác.' : 'Gửi đánh giá thất bại, vui lòng thử lại.');
    } finally { sending.current = false; setSubmitting(false); }
  }

  return <dialog ref={dialog} className="rb-review-dialog" aria-labelledby="review-title" aria-describedby="review-description"
    onCancel={(event) => { event.preventDefault(); if (!sending.current) onClose(); }}>
    <h2 id="review-title">Đánh giá “{restaurantName}”</h2>
    <p id="review-description">Trải nghiệm của bạn giúp quán và thực khách khác tốt hơn.</p>
    <form onSubmit={submit} aria-busy={submitting}>
      {error && <p className="auth-alert" role="alert">{error}</p>}
      <fieldset className="rb-review-rating" disabled={submitting || alreadyReviewed}>
        <legend>Chọn số sao (bắt buộc)</legend>
        <div>{[1, 2, 3, 4, 5].map((star) => <button type="button" key={star} aria-label={`${star} sao`} aria-pressed={star === rating}
          className={star <= rating ? 'selected' : ''} onClick={() => { setRating(star); setError(''); }}>★</button>)}</div>
        <span role="status">{rating ? `${rating}/5 sao` : 'Chưa chọn sao'}</span>
      </fieldset>
      <label className="rb-review-comment">Nhận xét (không bắt buộc)
        <textarea rows={4} maxLength={1000} disabled={submitting || alreadyReviewed} value={comment} onChange={(event) => setComment(event.target.value)}
          placeholder="Chia sẻ thêm về món ăn, chất lượng phục vụ..." />
      </label>
      <small>{comment.length}/1000 ký tự</small>
      <div className="rb-dialog-actions">
        <button type="button" className="btn secondary" disabled={submitting} onClick={onClose}>{alreadyReviewed ? 'Đóng' : 'Để sau'}</button>
        <button type="submit" className="btn primary" disabled={submitting || alreadyReviewed}>{submitting ? 'Đang gửi…' : 'Gửi đánh giá'}</button>
      </div>
    </form>
  </dialog>;
}
