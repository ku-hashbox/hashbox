import { Route, Routes } from 'react-router-dom';
import Layout from './Layout';
import SendPage from '../features/send/SendPage';
import ReceivePage from '../features/receive/ReceivePage';
import ManagePage from '../features/manage/ManagePage';
import NotFoundPage from './NotFoundPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<SendPage />} />
        <Route path="/s/:id" element={<ReceivePage />} />
        <Route path="/m" element={<ManagePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
