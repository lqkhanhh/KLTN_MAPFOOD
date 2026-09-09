import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { request } from '../api';
import RestaurantCard from '../components/RestaurantCard';
import { ExploreMap } from '../components/ExploreMap';
import { useCurrentLocation } from '../hooks/useCurrentLocation';

interface Restaurant {
  id: string;
  name: string;
  address?: string;
  imageUrl?: string;
  rating?: number | string;
  location?: { type: string; coordinates: number[] };
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
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [userPosition, setUserPosition] = useState<any>(null);
  const { getCurrentLocation, loading: locating, error: locationError } = useCurrentLocation();
  const mounted = useRef(true);
  const locate = useCallback(() => {
    // Bản đồ chỉ cần tọa độ, không chờ dịch vụ tra ngược địa chỉ.
    getCurrentLocation({ resolveAddress: false }).then((point) => { if (mounted.current) setUserPosition(point); }).catch(() => {});
  }, [getCurrentLocation]);
  useEffect(() => { mounted.current = true; locate(); return () => { mounted.current = false; }; }, [locate]);
  useEffect(() => {
    const timer = window.setTimeout(() => { setSearch(input.trim()); setPage(1); }, 400);
    return () => window.clearTimeout(timer);
  }, [input]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    // Khám phá công khai: không gửi JWT, không dùng quán mock thay dữ liệu API.
    request(`/restaurants?page=${page}&limit=${PAGE_SIZE}${search ? `&search=${encodeURIComponent(search)}` : ''}`, { authorized: false })
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
  }, [page, retry, search]);

  return <main className="route-home rb-explore-page">
    <div className="rb-explore-heading"><p>ROUTEBITE</p><h1>Khám phá quán</h1><span>Khám phá các quán đang hoạt động và chọn món bạn thích.</span></div>
    <form className="rb-explore-search" role="search" onSubmit={(event) => { event.preventDefault(); setSearch(input.trim()); setPage(1); }}>
      <label htmlFor="explore-search">Tìm quán hoặc món ăn</label>
      <div><input id="explore-search" type="search" placeholder="Tìm quán, món ăn..." value={input} maxLength={120} onChange={(event) => setInput(event.target.value)} />
        {input && <button type="button" aria-label="Xóa tìm kiếm" onClick={() => { setInput(''); setSearch(''); setPage(1); }}>Xóa</button>}</div>
    </form>
    <ExploreMap restaurants={loading || error ? [] : restaurants} userPosition={userPosition} locating={locating} locationError={locationError} onLocate={locate} />
    {loading ? <section aria-label="Đang tải danh sách quán" aria-busy="true">
      <p role="status">Đang tải danh sách quán…</p>
      <div className="restaurant-result-grid" aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <div className="restaurant-skeleton" key={index} />)}</div>
    </section> : error ? <section className="route-empty">
      <p role="alert">{error}</p><button className="btn secondary" type="button" onClick={() => setRetry((value) => value + 1)}>Thử lại</button>
    </section> : restaurants.length === 0 ? <section className="route-empty" role="status">{search ? `Không tìm thấy quán hoặc món ăn phù hợp với “${search}”.` : 'Chưa có quán nào trong hệ thống.'}</section>
      : <>
        <p className="rb-explore-count" role="status">{total} quán {search ? `phù hợp với “${search}”` : 'đang hoạt động'}</p>
        <section className="restaurant-result-grid" aria-label="Danh sách quán">
          {restaurants.map((restaurant) => <RestaurantCard key={restaurant.id} restaurant={restaurant}
            userPosition={userPosition}
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
