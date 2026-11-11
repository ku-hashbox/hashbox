import { Link, Outlet } from 'react-router-dom';
import ApiStatus from '../components/ApiStatus';

/** 공통 헤더·푸터 (FE2) */
export default function Layout() {
  return (
    <div className="layout">
      <header>
        <Link to="/">Hashbox</Link>
      </header>
      <main>
        <Outlet />
      </main>
      <footer>
        <p>내용은 브라우저에서 암호화되고, 서버는 열쇠를 볼 수 없어요.</p>
        {(import.meta.env.DEV || import.meta.env.VITE_SHOW_API_STATUS === 'true') && <ApiStatus />}
      </footer>
    </div>
  );
}
