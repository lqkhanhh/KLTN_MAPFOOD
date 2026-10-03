import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { request } from '../api';

export function VnpayReturnPage() {
  const { search } = useLocation();
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [waiting, setWaiting] = useState(true);
  useEffect(() => {
    let stopped = false;
    let timer;
    let count = 0;
    setResult(null); setError(''); setWaiting(true);
    async function check() {
      try {
        const data = await request(`/payments/vnpay-return${search}`, { authorized: false });
        if (stopped) return;
        setResult(data);
        if (data.status === 'PENDING' && ++count < 20) timer = setTimeout(check, 3000);
        else setWaiting(false);
      } catch (e) { if (!stopped) { setError(e.message); setWaiting(false); } }
    }
    check();
    return () => { stopped = true; clearTimeout(timer); };
  }, [search]);
  const paid = result?.status === 'PAID';
  const pending = result?.status === 'PENDING';
  return <main className="container" style={{ maxWidth: 640, margin: '48px auto', padding: 24 }}>
    <section className="card" style={{ padding: 28 }} aria-live="polite">
      <p>THANH TOÁN VNPAY</p>
      <h1>{error ? 'Chưa xác minh được thanh toán' : paid ? 'Thanh toán thành công' : waiting ? 'Đang xác nhận thanh toán…' : pending ? 'Đang chờ VNPAY xác nhận' : result?.status === 'REFUNDED' ? 'Giao dịch đã hoàn tiền' : 'Thanh toán chưa hoàn tất'}</h1>
      <p>{error || (paid ? 'Hệ thống đã ghi nhận khoản thanh toán của bạn.' : pending ? 'Nếu ngân hàng đã trừ tiền, vui lòng chờ và kiểm tra đơn hàng trước khi thanh toán lại.' : waiting ? 'Vui lòng chờ trong giây lát.' : 'Bạn có thể xem trạng thái và thử lại từ trang đơn hàng.')}</p>
      {result?.orderId && <Link className="btn" to={`/orders/${result.orderId}`}>Xem đơn hàng</Link>}
      {' '}<Link to="/my-orders">Danh sách đơn hàng</Link>
    </section>
  </main>;
}
