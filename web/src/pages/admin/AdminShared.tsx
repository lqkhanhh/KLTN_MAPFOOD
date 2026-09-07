export function LoadError({ error, retry }: { error: string; retry: () => void }) {
  return <div className="rb-admin-error"><p role="alert">{error}</p><button className="btn secondary" onClick={retry}>Thử lại</button></div>;
}

export function Pagination({ page, total, limit, onPage, disabled = false }: {
  page: number; total: number; limit: number; onPage: (page: number) => void; disabled?: boolean;
}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  return <nav className="rb-admin-pagination" aria-label="Phân trang">
    <span>{total.toLocaleString('vi-VN')} kết quả · Trang {page}/{pages}</span>
    <button className="btn secondary" disabled={disabled || page <= 1} onClick={() => onPage(page - 1)}>Trang trước</button>
    <button className="btn secondary" disabled={disabled || page >= pages} onClick={() => onPage(page + 1)}>Trang sau</button>
  </nav>;
}
