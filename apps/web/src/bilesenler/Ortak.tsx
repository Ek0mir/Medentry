import { type ReactNode, useEffect } from 'react';
import { kademeDurumu } from './bicim.js';

export function Yukleniyor({ metin = 'Yükleniyor…' }: { metin?: string }) {
  return <div className="yukleniyor">{metin}</div>;
}

export function Hata({ hata }: { hata: unknown }) {
  const mesaj = hata instanceof Error ? hata.message : 'Bilinmeyen hata';
  return (
    <div className="hata-kutusu">
      <strong>Veri alınamadı.</strong> {mesaj}
    </div>
  );
}

export function BosDurum({ baslik, aciklama }: { baslik: string; aciklama?: string }) {
  return (
    <div className="bos-durum">
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{baslik}</div>
      {aciklama && <div style={{ fontSize: 13 }}>{aciklama}</div>}
    </div>
  );
}

export function Olcu({
  etiket,
  deger,
  not,
  vurgu,
}: {
  etiket: string;
  deger: ReactNode;
  not?: ReactNode;
  vurgu?: 'iyi' | 'uyari' | 'kritik';
}) {
  return (
    <div className={`olcu${vurgu ? ` ${vurgu}` : ''}`}>
      <div className="olcu-etiket">{etiket}</div>
      <div className="olcu-deger">{deger}</div>
      {not && <div className="olcu-not">{not}</div>}
    </div>
  );
}

/** Risk kademesi rozeti — nokta + METİN. Renk tek başına bırakılmaz. */
export function KademeRozeti({ kademe, ad }: { kademe: number | null; ad: string | null }) {
  if (kademe === null) return <span className="rozet rozet-notr">veri yok</span>;
  const { sinif, renk } = kademeDurumu(kademe);
  return (
    <span className={`rozet ${sinif}`} title={ad ?? undefined}>
      <span className="nokta" style={{ background: renk }} aria-hidden="true" />
      {kademe}. {ad ?? 'kademe'}
    </span>
  );
}

export function EskalasyonRozeti({ seviye }: { seviye: number }) {
  if (!seviye) return null;
  const sinif = seviye >= 3 ? 'rozet-kritik' : seviye === 2 ? 'rozet-ciddi' : 'rozet-uyari';
  const hedef = seviye >= 3 ? 'üst onayda' : seviye === 2 ? 'yöneticide' : 'hatırlatıldı';
  return (
    <span className={`rozet ${sinif}`} title={`Eskalasyon seviye ${seviye}`}>
      S{seviye} · {hedef}
    </span>
  );
}

export function DurumRozeti({ durum, sonuc }: { durum: string; sonuc?: string | null }) {
  if (durum === 'ACIK') return <span className="rozet rozet-notr">Açık</span>;
  if (durum === 'IPTAL') return <span className="rozet rozet-notr">İptal</span>;
  return (
    <span className="rozet rozet-iyi" title={sonuc ?? undefined}>
      Kapalı{sonuc ? ` · ${sonuc.toLocaleLowerCase('tr')}` : ''}
    </span>
  );
}

export function Pencere({
  baslik,
  kapat,
  cocuklar,
  alt,
}: {
  baslik: string;
  kapat: () => void;
  cocuklar: ReactNode;
  alt?: ReactNode;
}) {
  // Esc ile kapanma: klavyeyle çalışanlar fareye uzanmasın.
  useEffect(() => {
    const dinle = (o: KeyboardEvent) => {
      if (o.key === 'Escape') kapat();
    };
    window.addEventListener('keydown', dinle);
    return () => window.removeEventListener('keydown', dinle);
  }, [kapat]);

  return (
    <div className="perde" onMouseDown={(o) => o.target === o.currentTarget && kapat()}>
      <div className="pencere" role="dialog" aria-modal="true" aria-label={baslik}>
        <div className="pencere-baslik">
          <strong>{baslik}</strong>
          <button className="dugme ikincil kucuk" onClick={kapat} aria-label="Kapat">
            ✕
          </button>
        </div>
        <div className="pencere-govde">{cocuklar}</div>
        {alt && <div className="pencere-alt">{alt}</div>}
      </div>
    </div>
  );
}
