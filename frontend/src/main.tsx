import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/playfair-display';
import '@fontsource-variable/plus-jakarta-sans';
import { BookingWizardPage } from './pages/public/BookingWizardPage';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BookingWizardPage />
  </StrictMode>,
);
