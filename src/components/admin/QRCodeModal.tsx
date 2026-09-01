import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import { X, Download, Printer, QrCode as QrCodeIcon, Copy, Check } from 'lucide-react';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  value: string;
  metaLines?: { label: string; value: string }[];
  fileName?: string;
  barcodeValue?: string;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  value,
  metaLines = [],
  fileName = 'reethau-qr-code',
  barcodeValue,
}) => {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [barcodeDataUrl, setBarcodeDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setDataUrl(null);
    QRCode.toDataURL(value, {
      width: 560,
      margin: 1,
      color: { dark: '#0A0F1D', light: '#FFFFFFFF' },
      errorCorrectionLevel: 'M',
    })
      .then(setDataUrl)
      .catch(() => setDataUrl(null));
  }, [isOpen, value]);

  useEffect(() => {
    if (!isOpen || !barcodeValue) {
      setBarcodeDataUrl(null);
      return;
    }
    try {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, barcodeValue, {
        format: 'CODE128',
        displayValue: true,
        fontSize: 16,
        height: 50,
        width: 2,
        margin: 8,
        background: '#FFFFFF',
        lineColor: '#0A0F1D',
      });
      setBarcodeDataUrl(canvas.toDataURL('image/png'));
    } catch {
      setBarcodeDataUrl(null);
    }
  }, [isOpen, barcodeValue]);

  if (!isOpen) return null;

  const handleDownload = () => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${fileName}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handlePrint = () => {
    if (!dataUrl) return;
    const win = window.open('', '_blank', 'width=480,height=640');
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>${title} — Reethau Asset QR</title>
          <style>
            * { box-sizing: border-box; }
            body {
              font-family: -apple-system, Segoe UI, Roboto, sans-serif;
              display: flex; flex-direction: column; align-items: center; justify-content: center;
              min-height: 100vh; margin: 0; padding: 24px; text-align: center; color: #0A0F1D;
            }
            img { width: 280px; height: 280px; }
            h2 { font-size: 16px; margin: 16px 0 4px; }
            p { font-size: 12px; color: #555; margin: 2px 0; }
            .sku { font-family: monospace; font-weight: 700; font-size: 13px; margin-bottom: 12px; color: #00A86B; }
          </style>
        </head>
        <body>
          <img src="${dataUrl}" alt="QR Code" />
          <h2>${title}</h2>
          ${subtitle ? `<div class="sku">${subtitle}</div>` : ''}
          ${metaLines.map((m) => `<p><strong>${m.label}:</strong> ${m.value}</p>`).join('')}
          ${barcodeDataUrl ? `<img src="${barcodeDataUrl}" alt="Barcode" style="width:220px;height:auto;margin-top:14px;" />` : ''}
          <script>window.onload = () => { window.print(); };</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable — ignore */
    }
  };

  return createPortal(
    <div className="admin-modal-overlay" style={{ zIndex: 130 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="glass-panel admin-modal-panel qr-modal-panel" style={{ border: '1px solid rgba(0, 208, 132, 0.4)' }}>
        <button onClick={onClose} className="admin-modal-close-btn" aria-label="Tutup">
          <X size={18} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div
            style={{
              width: '44px', height: '44px', borderRadius: '12px',
              background: 'rgba(0, 208, 132, 0.15)', color: '#00D084',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >
            <QrCodeIcon size={24} />
          </div>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--txt-primary)' }}>{title}</h3>
            {subtitle && (
              <div style={{ fontSize: '0.78rem', color: '#00D084', fontFamily: 'monospace', fontWeight: 700 }}>{subtitle}</div>
            )}
          </div>
        </div>

        <div className="qr-modal-code-wrap">
          {dataUrl ? (
            <img src={dataUrl} alt={`QR code untuk ${title}`} className="qr-modal-image" />
          ) : (
            <div className="qr-modal-image qr-modal-loading">Membuat kode QR...</div>
          )}
        </div>

        {barcodeDataUrl && (
          <div className="qr-modal-code-wrap" style={{ marginTop: '0.75rem', padding: '0.75rem' }}>
            <img src={barcodeDataUrl} alt={`Barcode untuk ${title}`} style={{ width: '100%', maxWidth: '260px', height: 'auto' }} />
          </div>
        )}

        {metaLines.length > 0 && (
          <div className="qr-modal-meta">
            {metaLines.map((m) => (
              <div key={m.label} className="qr-modal-meta-row">
                <span>{m.label}</span>
                <strong>{m.value}</strong>
              </div>
            ))}
          </div>
        )}

        <div className="qr-modal-actions">
          <button onClick={handleDownload} className="btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '0.7rem' }} disabled={!dataUrl}>
            <Download size={16} />
            Unduh PNG
          </button>
          <button onClick={handlePrint} className="btn-chip" style={{ flex: 1, justifyContent: 'center' }} disabled={!dataUrl}>
            <Printer size={16} />
            Cetak Label
          </button>
          <button onClick={handleCopy} className="btn-chip" style={{ flex: 1, justifyContent: 'center' }}>
            {copied ? <Check size={16} color="#00D084" /> : <Copy size={16} />}
            {copied ? 'Tersalin' : 'Salin Data'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};