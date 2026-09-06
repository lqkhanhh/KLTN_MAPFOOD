import { Link } from 'react-router-dom';

export default function AuthLayout({ children }) {
  return <main className="auth-layout"><section className="auth-brand-panel"><Link className="auth-brand-logo" to="/">RouteBite</Link><p className="auth-eyebrow">HÀNH TRÌNH ẨM THỰC</p><h1>Ẩm thực trên<br />mọi nẻo đường.</h1><p>Khám phá quán tiện đường, đặt món trước và ghé lấy đúng lúc bạn đến nơi.</p><div className="auth-brand-stats"><span>📍 Tìm quán dọc tuyến</span><span>⚡ Đặt trước, ghé lấy</span></div></section><section className="auth-form-panel"><div className="auth-form-wrap">{children}</div></section></main>;
}
