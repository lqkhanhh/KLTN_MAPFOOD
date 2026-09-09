import { useEffect, useState } from 'react';
import { request } from '../../api';
import { useMerchant } from '../../contexts/MerchantContext';
import { ReviewsSection } from '../../components/ReviewsSection';

export function MerchantReviewsPage() {
  const { restaurant } = useMerchant();
  if (!restaurant) return <p>Vui lòng chọn quán đang quản lý.</p>;
  // Đổi quán xóa ngay dữ liệu/bộ lọc cũ, không để phản hồi chậm của quán trước ghi đè.
  return <RestaurantReviews key={restaurant.id} restaurant={restaurant} />;
}
function RestaurantReviews({ restaurant }: { restaurant: { id: string; name: string } }) {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    request(`/restaurants/${encodeURIComponent(restaurant.id)}/manage`).then((data) => {
      if (!Array.isArray(data.reviews)) throw new Error('Dữ liệu đánh giá không hợp lệ.');
      if (active) setReviews(data.reviews);
    }).catch(() => { if (active) setError('Không thể tải đánh giá của quán. Vui lòng thử lại.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [restaurant.id, revision]);
  return <section>
    <div className="rb-merchant-page-head"><div><p className="rb-eyebrow">PHẢN HỒI TỪ KHÁCH HÀNG</p><h1>Đánh giá quán</h1><p>{restaurant.name}</p></div>
      <button className="btn secondary" type="button" disabled={loading} onClick={() => setRevision((value) => value + 1)}>Làm mới</button></div>
    {loading ? <p role="status">Đang tải đánh giá…</p> : error ? <div className="item-card"><p role="alert">{error}</p>
      <button type="button" className="btn secondary" onClick={() => setRevision((value) => value + 1)}>Thử lại</button></div>
      : <ReviewsSection embeddedReviews={reviews} merchant />}
  </section>;
}
