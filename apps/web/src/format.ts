/** Arayuz bicimlendirme yardimcilari (Turkce). */

export function formatHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return '-';
  const total = Math.round(hours * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} dk`;
  return `${h}s ${String(m).padStart(2, '0')}dk`;
}

export function formatTime(iso: string | null | undefined, timeZone = 'Europe/Istanbul'): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  });
}

export function formatDateTime(iso: string | null | undefined, timeZone = 'Europe/Istanbul'): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  });
}

export function formatMoney(value: number | null | undefined, currency = 'TRY'): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatAge(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return 'veri yok';
  if (seconds < 90) return 'az once';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} dk once`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} saat once`;
  return `${Math.round(hours / 24)} gun once`;
}

export const STATUS_LABEL: Record<string, string> = {
  working: 'Calisiyor',
  idle: 'Rolanti',
  stopped: 'Durdu',
  offline: 'Cevrimdisi',
};

export const EVENT_LABEL: Record<string, string> = {
  ignition_on: 'Kontak acildi',
  ignition_off: 'Kontak kapandi',
  overspeed: 'Hiz asimi',
  harsh_braking: 'Sert fren',
  harsh_acceleration: 'Sert hizlanma',
  harsh_cornering: 'Sert viraj',
  crash: 'Carpma',
  sos: 'Acil durum',
  power_cut: 'Guc kesildi',
  tow: 'Cekilme / kurcalama',
  jamming: 'Sinyal karistirma',
  fuel_drop: 'Ani yakit dususu',
  fuel_fill: 'Yakit dolumu',
  idle: 'Uzun rolanti',
  geofence_enter: 'Bolgeye girdi',
  geofence_exit: 'Bolgeden cikti',
  low_battery: 'Dusuk batarya',
};

export function eventLabel(type: string): string {
  return EVENT_LABEL[type] ?? type;
}
