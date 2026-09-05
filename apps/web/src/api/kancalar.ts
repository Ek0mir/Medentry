import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type CariRisk, type Gorev, type Oturum, type SonucSecenegi } from './istemci.js';

/**
 * Sorgu kancaları. Görev kapatma gibi yazma işlemlerinden sonra ilgili
 * listeler geçersizleştirilir — ekran kendiliğinden tazelenir.
 */

export function useOturum() {
  return useQuery<Oturum | null>({
    queryKey: ['oturum'],
    queryFn: async () => {
      try {
        return await api.al<Oturum>('/oturum/ben');
      } catch {
        return null;
      }
    },
    retry: false,
    staleTime: 60_000,
  });
}

export function useGiris() {
  const kuyruk = useQueryClient();
  return useMutation({
    mutationFn: (girdi: { kullaniciAdi: string; parola: string }) =>
      api.gonder<Oturum>('/oturum', girdi),
    onSuccess: () => kuyruk.invalidateQueries(),
  });
}

export function useCikis() {
  const kuyruk = useQueryClient();
  return useMutation({
    mutationFn: () => api.sil('/oturum'),
    onSuccess: () => kuyruk.clear(),
  });
}

export interface AramaListesi {
  gun: string;
  toplam: number;
  acik: number;
  kapanan: number;
  kapanmaOrani: number | null;
  satirlar: Gorev[];
}

export function useAramaListesi() {
  return useQuery<AramaListesi>({
    queryKey: ['arama-listesi'],
    queryFn: () => api.al('/arama-listesi/bugun'),
    refetchInterval: 60_000,
  });
}

export function useGorevler(sorgu: Record<string, string | number | undefined>) {
  const parametreler = new URLSearchParams();
  for (const [anahtar, deger] of Object.entries(sorgu)) {
    if (deger !== undefined && deger !== '') parametreler.set(anahtar, String(deger));
  }
  const metin = parametreler.toString();
  return useQuery<{ toplam: number; satirlar: Gorev[] }>({
    queryKey: ['gorevler', metin],
    queryFn: () => api.al(`/gorevler${metin ? `?${metin}` : ''}`),
  });
}

export function useGorevDetay(id: number | null) {
  return useQuery({
    queryKey: ['gorev', id],
    queryFn: () => api.al<{ gorev: Gorev; hareketler: unknown[]; eskalasyonlar: unknown[] }>(`/gorevler/${id}`),
    enabled: id !== null,
  });
}

export function useSonucSecenekleri() {
  return useQuery<{ tipler: Record<string, SonucSecenegi[]> }>({
    queryKey: ['sonuc-secenekleri'],
    queryFn: () => api.al('/gorevler/sonuc-secenekleri'),
    staleTime: Infinity,
  });
}

export interface KapatmaGirdisi {
  gorevId: number;
  sonuc: string;
  sonucNotu?: string;
  sozTarihi?: string;
  sozTutari?: number;
}

export function useGorevKapat() {
  const kuyruk = useQueryClient();
  return useMutation({
    mutationFn: ({ gorevId, ...govde }: KapatmaGirdisi) =>
      api.gonder<{ gorev: Gorev; takipGoreviId?: number }>(`/gorevler/${gorevId}/kapat`, govde),
    onSuccess: () => {
      void kuyruk.invalidateQueries({ queryKey: ['arama-listesi'] });
      void kuyruk.invalidateQueries({ queryKey: ['gorevler'] });
      void kuyruk.invalidateQueries({ queryKey: ['ozet'] });
      void kuyruk.invalidateQueries({ queryKey: ['cariler'] });
    },
  });
}

export function useCariler(sorgu: Record<string, string | number | undefined>) {
  const parametreler = new URLSearchParams();
  for (const [anahtar, deger] of Object.entries(sorgu)) {
    if (deger !== undefined && deger !== '') parametreler.set(anahtar, String(deger));
  }
  const metin = parametreler.toString();
  return useQuery<{ toplam: number; satirlar: CariRisk[]; uyari?: string }>({
    queryKey: ['cariler', metin],
    queryFn: () => api.al(`/cariler${metin ? `?${metin}` : ''}`),
  });
}

export interface CariDetayi {
  cari: CariRisk;
  faturalar: Record<string, unknown>[];
  cekler: Record<string, unknown>[];
  gorevler: Record<string, unknown>[];
  odemeSozleri: Record<string, unknown>[];
  yaslandirmaGecmisi: Record<string, number | string>[];
}

export function useCariDetay(kod: string | undefined) {
  return useQuery<CariDetayi>({
    queryKey: ['cari', kod],
    queryFn: () => api.al(`/cariler/${encodeURIComponent(kod!)}`),
    enabled: Boolean(kod),
  });
}

export interface YaslandirmaOzeti {
  tarih: string;
  cari_adedi: number;
  b_0_30: number;
  b_31_60: number;
  b_61_90: number;
  b_91_180: number;
  b_180_plus: number;
  vadesi_gelmemis: number;
  toplam: number;
  doksan_gun_ustu: number;
}

export interface Ozet {
  yaslandirma: YaslandirmaOzeti | null;
  dso: { tarih: string; acik_bakiye: number; ciro_90_gun: number; dso_gun: number | null } | null;
  gorev: {
    acik: number;
    gecikmis: number;
    eskalasyonda: number;
    bugun_acilan: number;
    bugun_kapanan: number;
  } | null;
  kademe: { sevk_durdurma_ustu: number; riskli_ve_ustu: number; toplam_cari: number } | null;
}

export function useOzet() {
  return useQuery<Ozet>({
    queryKey: ['ozet'],
    queryFn: () => api.al('/raporlar/ozet'),
    refetchInterval: 120_000,
  });
}

export function useRapor<S = Record<string, unknown>>(ad: string, etkin = true) {
  return useQuery<{ toplam: number; satirlar: S[] }>({
    queryKey: ['rapor', ad],
    queryFn: () => api.al(`/raporlar/${ad}`),
    enabled: etkin,
  });
}

export function useEskalasyonlar() {
  return useQuery<{ toplam: number; satirlar: Record<string, unknown>[] }>({
    queryKey: ['eskalasyonlar'],
    queryFn: () => api.al('/eskalasyonlar'),
  });
}

export function useKullanicilar() {
  return useQuery<{ kullanicilar: Record<string, unknown>[] }>({
    queryKey: ['kullanicilar'],
    queryFn: () => api.al('/kullanicilar'),
  });
}

export function useIsler() {
  return useQuery<{ isler: { kod: string; ad: string; zamanlama: string | null; aciklama: string }[] }>({
    queryKey: ['isler'],
    queryFn: () => api.al('/isler'),
  });
}

export function useIsCalistir() {
  const kuyruk = useQueryClient();
  return useMutation({
    mutationFn: ({ kod, ...govde }: { kod: string; gun?: string; zorla?: boolean }) =>
      api.gonder<{ kod: string; ozet: string; basarili: boolean; sureMs: number }>(
        `/isler/${kod}/calistir`,
        govde,
      ),
    onSuccess: () => kuyruk.invalidateQueries(),
  });
}

export function useSaglik() {
  return useQuery<{
    saglikli: boolean;
    bulgular: { ad: string; saglikli: boolean; mesaj: string }[];
    ts: string;
  }>({
    queryKey: ['saglik'],
    queryFn: () => api.al('/saglik'),
    refetchInterval: 120_000,
    retry: false,
  });
}
