import { LoadError } from './AdminShared';
import { numberText, ROLE_LABELS, useAdminData, type OverviewData, type SearchStats } from './adminData';

export function AdminOverviewPage() {
  const overview = useAdminData<OverviewData>('/admin/dashboard/overview');
  const analytics = useAdminData<SearchStats>('/admin/search-analytics');
  const data = overview.data;
  const stats = data ? [
    { label: 'Tổng người dùng', value: numberText(data.usersByRole.reduce((sum, item) => sum + item.count, 0)) },
    { label: 'Tổng số quán', value: numberText(data.totalRestaurants) },
    { label: 'Tổng đơn hàng', value: numberText(data.totalOrders) },
    { label: 'Tổng giá trị giao dịch (GMV)', value: numberText(data.gmv) + 'đ' },
    { label: 'Người dùng mới tháng này', value: numberText(data.newUsersThisMonth) },
  ] : [];
  return <>
    <header className="rb-admin-heading"><p>QUẢN TRỊ HỆ THỐNG</p><h1>Tổng quan hệ thống</h1><span>Số liệu hoạt động trên toàn bộ RouteBite.</span></header>
    {overview.loading ? <p role="status">Đang tải tổng quan…</p> : overview.error ? <LoadError error={overview.error} retry={overview.refresh} /> : data && <>
      <section className="rb-admin-metrics" aria-label="Số liệu tổng quan">{stats.map((stat) => <article className="item-card" key={stat.label}><p>{stat.label}</p><strong>{stat.value}</strong></article>)}</section>
      <p className="rb-admin-hint">GMV là tổng giá trị đơn đã thanh toán, không phải doanh thu hoa hồng của nền tảng.</p>
      <div className="rb-admin-panels">
        <section className="item-card"><h2>Người dùng theo vai trò</h2><dl className="rb-admin-summary">{Object.entries(ROLE_LABELS).map(([role, label]) => <div key={role}><dt>{label}</dt><dd>{numberText(data.usersByRole.find((item) => item.role === role)?.count ?? 0)}</dd></div>)}</dl></section>
        <section className="item-card"><h2>Quán có nhiều đơn nhất</h2>{data.topRestaurants.length ? <ol className="rb-admin-ranking">{data.topRestaurants.map((shop) => <li key={shop.id}><span>{shop.name}</span><strong>{numberText(shop.orderCount)} đơn</strong></li>)}</ol> : <p>Chưa có dữ liệu đơn hàng.</p>}</section>
      </div>
    </>}
    <section className="item-card rb-admin-analytics"><h2>Thống kê tìm kiếm theo lộ trình</h2>
      {analytics.loading ? <p role="status">Đang tải thống kê tìm kiếm…</p> : analytics.error ? <LoadError error={analytics.error} retry={analytics.refresh} /> : analytics.data && <>
        <p>Tổng lượt tìm kiếm đã ghi nhận: <strong>{numberText(analytics.data.totalSearches)}</strong></p>
        {analytics.data.popularOriginAreas.length ? <div className="rb-admin-table-wrap" tabIndex={0} aria-label="Điểm xuất phát phổ biến"><table><thead><tr><th>Vĩ độ điểm đi</th><th>Kinh độ điểm đi</th><th>Lượt tìm</th></tr></thead><tbody>{analytics.data.popularOriginAreas.map((area, index) => <tr key={index}><td>{area.latitude.toFixed(5)}</td><td>{area.longitude.toFixed(5)}</td><td>{numberText(area.count)}</td></tr>)}</tbody></table></div> : <p>Chưa có dữ liệu tìm kiếm.</p>}
        <p className="rb-admin-hint">API hiện chỉ cung cấp tọa độ điểm xuất phát và số lượt tìm, chưa có tên khu vực hoặc tỷ lệ chuyển đổi thành đơn.</p>
      </>}
    </section>
  </>;
}
