import { useId, useMemo, useState } from 'react';

interface Review {
  id: string;
  rating: number | string;
  comment?: string | null;
  createdAt: string;
  customer?: { fullName?: string | null };
}

export function ReviewsSection({ embeddedReviews = [], merchant = false }: { embeddedReviews?: Review[]; merchant?: boolean }) {
  const titleId = useId();
  const [starFilter, setStarFilter] = useState(0);
  // API chi tiết đã nhúng toàn bộ đánh giá: không gọi thêm API hoặc lưu bản sao state dễ bị cũ.
  const data = useMemo(() => {
    const reviews = embeddedReviews.filter((review) => Number.isInteger(Number(review.rating)) && Number(review.rating) >= 1 && Number(review.rating) <= 5)
      .slice().sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0) || b.id.localeCompare(a.id));
    const distribution: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach((review) => { distribution[Number(review.rating)]++; });
    return { reviews, distribution, average: reviews.length ? reviews.reduce((sum, review) => sum + Number(review.rating), 0) / reviews.length : 0 };
  }, [embeddedReviews]);
  const total = data.reviews.length;
  const filteredReviews = starFilter ? data.reviews.filter((review) => Number(review.rating) === starFilter) : data.reviews;
  return <section className="item-card rb-restaurant-reviews" aria-labelledby={titleId}>
    <h2 id={titleId}>Đánh giá từ khách hàng</h2>
    {!total ? <p className="rb-reviews-empty">Chưa có đánh giá nào cho quán này. {merchant ? 'Đánh giá của khách sẽ xuất hiện sau khi đơn hoàn thành.' : 'Bạn có thể đánh giá sau khi hoàn thành đơn hàng.'}</p> : <>
      <div className="rb-reviews-summary">
        <div className="rb-review-average">
          <strong>{data.average.toFixed(1)}<small>/5</small></strong>
          <span className="rb-average-stars" role="img" aria-label={`${data.average.toFixed(1)} trên 5 sao`}>
            <span aria-hidden="true">★★★★★</span><span aria-hidden="true" style={{ width: `${data.average / 5 * 100}%` }}>★★★★★</span>
          </span>
          <p>{total} đánh giá</p>
        </div>
        <div className="rb-review-distribution" aria-label="Phân bố số sao">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = data.distribution[star];
            const percent = count / total * 100;
            return <div className="rb-distribution-row" key={star}>
              <span>{star} sao</span>
              <div className="rb-distribution-track" role="progressbar" aria-label={`${star} sao`} aria-valuemin={0} aria-valuemax={100}
                aria-valuenow={Number(percent.toFixed(1))} aria-valuetext={`${count} đánh giá (${percent.toFixed(1)}%)`}>
                <div style={{ width: `${percent}%` }} />
              </div>
              <span>{count}</span>
            </div>;
          })}
        </div>
      </div>
      <div className="rb-review-filters" role="group" aria-label="Lọc đánh giá theo số sao">
        {[0, 5, 4, 3, 2, 1].map((star) => <button type="button" key={star} aria-pressed={starFilter === star} onClick={() => setStarFilter(star)}>
          {star ? `${star} sao` : 'Tất cả'} ({star ? data.distribution[star] : total})
        </button>)}
      </div>
      <p className="rb-review-filter-status" role="status">{filteredReviews.length ? `Hiển thị ${filteredReviews.length} đánh giá${starFilter ? ` ${starFilter} sao` : ''}.` : `Chưa có đánh giá ${starFilter} sao.`}</p>
      <div className="rb-reviews-list">{filteredReviews.map((review) => {
        const date = new Date(review.createdAt);
        const rating = Number(review.rating);
        return <article key={review.id}>
          <header><strong>{review.customer?.fullName?.trim() || 'Khách hàng'}</strong>
            {Number.isNaN(date.getTime()) ? <span>Chưa rõ ngày</span> : <time dateTime={review.createdAt}>{date.toLocaleDateString('vi-VN')}</time>}
          </header>
          <p className="rb-review-stars" aria-label={`${rating} trên 5 sao`}>{'★'.repeat(rating)}{'☆'.repeat(5 - rating)}</p>
          <small>Khách đã hoàn thành đơn</small>
          {review.comment?.trim() && <p className="rb-review-text">{review.comment}</p>}
        </article>;
      })}</div>
    </>}
  </section>;
}
