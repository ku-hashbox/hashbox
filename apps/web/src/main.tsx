import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import SendPage from './pages/SendPage';
import ReceivePage from './pages/ReceivePage';
import ManagePage from './pages/ManagePage';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SendPage />} />
        <Route path="/s/:id" element={<ReceivePage />} />
        <Route path="/m" element={<ManagePage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
