import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { request } from '../api';
import RestaurantCard from '../components/RestaurantCard';

interface Restaurant {
  id: string;
  name: string;
  address?: string;
  imageUrl?: string;
  rating?: number | string;
}
const PAGE_SIZE = 12;

export function ExplorePage() {
  const navigate = useNavigate();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    // Khám phá công khai: không gửi JWT, không dùng quán mock thay dữ liệu API.
    request(`/restaurants?page=${page}&limit=${PAGE_SIZE}`, { authorized: false })
      .then((response) => {
        if (!active) return;
        const rows = Array.isArray(response) ? response : response?.data;
        if (!Array.isArray(rows)) throw new Error('Dữ liệu danh sách quán không hợp lệ');
        setRestaurants(rows);
        setTotal(Array.isArray(response) ? rows.length : Number(response.total) || rows.length);
      })
      .catch((cause) => {
        if (!active) return;
        setRestaurants([]);
        setError(cause.status === 404
          ? 'Tính năng đang được hoàn thiện, vui lòng quay lại sau.'
          : 'Không thể tải danh sách quán, vui lòng thử lại.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, retry]);

  return <main className="route-home rb-explore-page">
    <div className="rb-explore-heading"><p>ROUTEBITE</p><h1>Khám phá quán</h1><span>Khám phá các quán đang hoạt động và chọn món bạn thích.</span></div>
    {loading ? <section aria-label="Đang tải danh sách quán" aria-busy="true">
      <p role="status">Đang tải danh sách quán…</p>
      <div className="restaurant-result-grid" aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <div className="restaurant-skeleton" key={index} />)}</div>
    </section> : error ? <section className="route-empty">
      <p role="alert">{error}</p><button className="btn secondary" type="button" onClick={() => setRetry((value) => value + 1)}>Thử lại</button>
    </section> : restaurants.length === 0 ? <section className="route-empty" role="status">Chưa có quán nào trong hệ thống.</section>
      : <>
        <p className="rb-explore-count" role="status">{total} quán đang hoạt động</p>
        <section className="restaurant-result-grid" aria-label="Danh sách quán">
          {restaurants.map((restaurant) => <RestaurantCard key={restaurant.id} restaurant={restaurant}
            onOpen={() => navigate(`/restaurant/${restaurant.id}`)} />)}
        </section>
      </>}
    {!loading && !error && total > PAGE_SIZE && <nav className="rb-explore-pagination" aria-label="Phân trang quán">
      <button className="btn secondary" type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Trang trước</button>
      <span>Trang {page} / {Math.ceil(total / PAGE_SIZE)}</span>
      <button className="btn secondary" type="button" disabled={page * PAGE_SIZE >= total} onClick={() => setPage((value) => value + 1)}>Trang sau</button>
    </nav>}
  </main>;
}
