import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Uygulama } from './Uygulama.jsx';

// Fontlar paketle birlikte gelir: LAN'da internet olmadan da doğru görünsün.
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import './tasarim/stil.css';

const kuyruk = new QueryClient({
  defaultOptions: {
    queries: {
      // Ofis içi LAN: yeniden denemeye gerek yok, hata hemen görünsün.
      retry: 1,
      refetchOnWindowFocus: true,
      staleTime: 20_000,
    },
  },
});

createRoot(document.getElementById('kok')!).render(
  <StrictMode>
    <QueryClientProvider client={kuyruk}>
      <BrowserRouter>
        <Uygulama />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
