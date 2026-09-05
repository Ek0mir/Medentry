import { useState } from 'react';
import { BANT_TANIMLARI, para, paraKisa, sayi } from './bicim.js';

/**
 * Grafikler saf SVG ile çiziliyor — kütüphane yok.
 *
 * Sebep: panel ofis içi LAN'da, internetsiz çalışacak. CDN'den grafik
 * kütüphanesi çekmek kurulumu kırılgan yapardı; ihtiyacımız olan üç form
 * (yığılmış bant çubuğu, sıralı çubuk listesi, tek seri çizgi) elle çizilecek
 * kadar basit.
 *
 * Renk kuralı: yaşlandırma bantları KATEGORİ DEĞİL, sıralı bir şiddet
 * ölçeğidir — tek hue, açık→koyu. Böylece renk körlüğünde ve gri baskıda da
 * "hangisi daha kötü" okunur. Her segment ayrıca etiketli ve tablo görünümü var.
 */

interface BantVerisi {
  b_0_30: number;
  b_31_60: number;
  b_61_90: number;
  b_91_180: number;
  b_180_plus: number;
}

export function YaslandirmaCubugu({
  veri,
  yukseklik = 34,
  etiketGoster = true,
}: {
  veri: BantVerisi;
  yukseklik?: number;
  etiketGoster?: boolean;
}) {
  const [uzerinde, setUzerinde] = useState<number | null>(null);
  const dilimler = BANT_TANIMLARI.map((b) => ({
    ...b,
    tutar: Number(veri[b.anahtar as keyof BantVerisi] ?? 0),
  }));
  const toplam = dilimler.reduce((t, d) => t + d.tutar, 0);

  if (toplam <= 0) {
    return <div className="alt-metin">Vadesi geçen bakiye yok.</div>;
  }

  let kayma = 0;
  const genislik = 100;

  return (
    <div className="grafik-sar">
      <svg
        viewBox={`0 0 ${genislik} ${yukseklik}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: yukseklik, display: 'block' }}
        role="img"
        aria-label={`Yaşlandırma dağılımı, toplam ${para(toplam)}`}
      >
        {dilimler.map((dilim, i) => {
          const oran = (dilim.tutar / toplam) * genislik;
          if (oran <= 0) return null;
          const x = kayma;
          kayma += oran;
          // Segmentler arasında 2px yüzey boşluğu: bitişik dolgular
          // birbirine yapışmasın (dataviz mark spec'i).
          const bosluk = i === dilimler.length - 1 ? 0 : 0.4;
          return (
            <rect
              key={dilim.anahtar}
              x={x}
              y={0}
              width={Math.max(0, oran - bosluk)}
              height={yukseklik}
              fill={dilim.renk}
              opacity={uzerinde === null || uzerinde === i ? 1 : 0.45}
              onMouseEnter={() => setUzerinde(i)}
              onMouseLeave={() => setUzerinde(null)}
            >
              <title>
                {dilim.ad}: {para(dilim.tutar)} (%{((dilim.tutar / toplam) * 100).toFixed(1)}) — {dilim.aksiyon}
              </title>
            </rect>
          );
        })}
      </svg>

      {etiketGoster && (
        <div className="gosterge">
          {dilimler.map((dilim, i) => (
            <span
              key={dilim.anahtar}
              className="gosterge-oge"
              style={{ color: uzerinde === i ? 'var(--murekkep)' : undefined }}
              onMouseEnter={() => setUzerinde(i)}
              onMouseLeave={() => setUzerinde(null)}
            >
              <span className="gosterge-kutu" style={{ background: dilim.renk }} aria-hidden="true" />
              {dilim.ad} <strong style={{ color: 'var(--murekkep)' }}>{paraKisa(dilim.tutar)}</strong>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Sıralı çubuk listesi (kademe dağılımı gibi).
 * Değer her çubukta doğrudan yazılı — eksene bakmak gerekmez.
 */
export function CubukListesi({
  satirlar,
  bicimlendir = (n: number) => sayi(n),
}: {
  satirlar: { etiket: string; deger: number; renk?: string; not?: string }[];
  bicimlendir?: (n: number) => string;
}) {
  const enBuyuk = Math.max(1, ...satirlar.map((s) => s.deger));
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {satirlar.map((satir) => (
        <div
          key={satir.etiket}
          style={{ display: 'grid', gridTemplateColumns: '150px 1fr 76px', gap: 10, alignItems: 'center' }}
        >
          <div style={{ fontSize: 12.5, color: 'var(--gri)' }} title={satir.not}>
            {satir.etiket}
          </div>
          <div style={{ background: 'var(--yuzey-2)', borderRadius: 2, height: 16, overflow: 'hidden' }}>
            <div
              style={{
                width: `${(satir.deger / enBuyuk) * 100}%`,
                height: '100%',
                background: satir.renk ?? 'var(--mavi-acik)',
                borderRadius: '0 2px 2px 0',
                minWidth: satir.deger > 0 ? 2 : 0,
              }}
            />
          </div>
          <div className="sayi" style={{ fontSize: 12.5 }}>
            {bicimlendir(satir.deger)}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Tek seri çizgi grafiği (trend). Tek seri olduğu için gösterge kutusu yok —
 * başlık zaten neyi gösterdiğini söylüyor.
 *
 * Noktalar İNDİSE göre değil GERÇEK TARİHE göre yerleştirilir. Aradaki hafta
 * sonu, tatil veya sistemin kapalı kaldığı günler grafikte de boşluk olarak
 * görünsün: eşit aralıklı çizmek "her gün ölçüldü" yalanını söyler.
 */
export function TrendCizgisi({
  noktalar,
  yukseklik = 130,
  bicimlendir = (n: number) => sayi(n, 1),
  birim = '',
}: {
  noktalar: { tarih: string; etiket: string; deger: number }[];
  yukseklik?: number;
  bicimlendir?: (n: number) => string;
  birim?: string;
}) {
  const [imlec, setImlec] = useState<number | null>(null);

  if (noktalar.length < 2) {
    return <div className="alt-metin">Trend için en az iki günlük veri gerekli.</div>;
  }

  const G = 320;
  const Y = yukseklik;
  const bosluk = { ust: 12, alt: 20, sol: 6, sag: 6 };

  const zamanlar = noktalar.map((n) => new Date(n.tarih).getTime());
  const ilkZaman = Math.min(...zamanlar);
  const sonZaman = Math.max(...zamanlar);
  const zamanAraligi = sonZaman - ilkZaman || 1;

  const enAz = Math.min(...noktalar.map((n) => n.deger));
  const enCok = Math.max(...noktalar.map((n) => n.deger));
  const aralik = enCok - enAz || 1;

  const x = (i: number) =>
    bosluk.sol + ((zamanlar[i]! - ilkZaman) / zamanAraligi) * (G - bosluk.sol - bosluk.sag);
  const y = (deger: number) =>
    bosluk.ust + (1 - (deger - enAz) / aralik) * (Y - bosluk.ust - bosluk.alt);

  const cizgi = noktalar
    .map((n, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(n.deger).toFixed(1)}`)
    .join(' ');
  const secili = imlec !== null ? noktalar[imlec] : null;

  return (
    <div className="grafik-sar">
      <svg
        viewBox={`0 0 ${G} ${Y}`}
        style={{ width: '100%', height: Y, display: 'block' }}
        role="img"
        aria-label="Trend grafiği"
        onMouseLeave={() => setImlec(null)}
      >
        <path d={cizgi} fill="none" stroke="var(--mavi-acik)" strokeWidth={2} strokeLinejoin="round" />
        {/* Ölçüm noktaları görünür kalsın: seyrek veride çizgi tek başına
            kaç ölçüm olduğunu söylemez. */}
        {noktalar.map((n, i) => (
          <circle
            key={n.tarih}
            cx={x(i)}
            cy={y(n.deger)}
            r={imlec === i ? 4 : 2.5}
            fill="var(--mavi-acik)"
            stroke="var(--kagit)"
            strokeWidth={imlec === i ? 2 : 1}
          />
        ))}
        {noktalar.map((n, i) => (
          <g key={`vurus-${n.tarih}`}>
            {/* Görünmez geniş vuruş alanı: nokta küçük olsa da hedeflemesi kolay. */}
            <rect
              x={x(i) - 9}
              y={0}
              width={18}
              height={Y}
              fill="transparent"
              onMouseEnter={() => setImlec(i)}
            />
            {imlec === i && (
              <line
                x1={x(i)}
                y1={bosluk.ust}
                x2={x(i)}
                y2={Y - bosluk.alt}
                stroke="var(--cizgi)"
                strokeWidth={1}
              />
            )}
          </g>
        ))}
        {/* Yalnızca ilk ve son etiket: her noktaya sayı basmak gürültü olur. */}
        <text x={x(0)} y={Y - 6} fontSize={9} fill="var(--gri)" textAnchor="start">
          {noktalar[0]!.etiket}
        </text>
        <text x={x(noktalar.length - 1)} y={Y - 6} fontSize={9} fill="var(--gri)" textAnchor="end">
          {noktalar[noktalar.length - 1]!.etiket}
        </text>
      </svg>
      {secili && (
        <div style={{ fontSize: 12, color: 'var(--gri)', marginTop: 2 }}>
          <strong style={{ color: 'var(--murekkep)' }}>
            {bicimlendir(secili.deger)}
            {birim}
          </strong>{' '}
          · {secili.etiket}
        </div>
      )}
    </div>
  );
}

/** Risk skorunun bileşen kırılımı — "neden bu skor" sorusunun cevabı. */
export function SkorKirilimi({
  bilesenler,
}: {
  bilesenler: { ad: string; agirlik: number; katki: number; aciklama: string }[];
}) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {bilesenler.map((b) => (
        <div key={b.ad}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12.5 }}>
            <span>{b.ad}</span>
            <span className="sayi" style={{ color: 'var(--gri)' }}>
              {b.katki.toFixed(1)} / {b.agirlik}
            </span>
          </div>
          <div style={{ background: 'var(--yuzey-2)', borderRadius: 2, height: 8, overflow: 'hidden', margin: '3px 0' }}>
            <div
              style={{
                width: `${(b.katki / b.agirlik) * 100}%`,
                height: '100%',
                background: 'var(--mavi-acik)',
                borderRadius: '0 2px 2px 0',
              }}
            />
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--gri)' }}>{b.aciklama}</div>
        </div>
      ))}
    </div>
  );
}
