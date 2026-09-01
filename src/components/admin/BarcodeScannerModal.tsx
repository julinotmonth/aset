import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ScanLine, CameraOff, Loader2, FlashlightOff, Flashlight, RefreshCcw } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import type { CameraDevice } from 'html5-qrcode/esm/camera/core';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (value: string) => void;
}

const SCANNER_ELEMENT_ID = 'reethau-barcode-scanner-region';

type ScannerStatus = 'starting' | 'scanning' | 'denied' | 'no-camera' | 'error';

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({ isOpen, onClose, onScan }) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [status, setStatus] = useState<ScannerStatus>('starting');
  const [errorDetail, setErrorDetail] = useState('');
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [cameraIndex, setCameraIndex] = useState(0);
  const hasScannedRef = useRef(false);

  const stopScanner = async () => {
    const instance = scannerRef.current;
    scannerRef.current = null;
    if (instance) {
      try {
        if (instance.isScanning) await instance.stop();
        instance.clear();
      } catch {
        // Scanner may already be stopped/torn down — safe to ignore.
      }
    }
  };

  const startScanner = async (deviceId?: string) => {
    setStatus('starting');
    setErrorDetail('');
    hasScannedRef.current = false;

    await stopScanner();

    try {
      const instance = new Html5Qrcode(SCANNER_ELEMENT_ID, { verbose: false });
      scannerRef.current = instance;

      let availableCameras = cameras;
      if (availableCameras.length === 0) {
        availableCameras = await Html5Qrcode.getCameras();
        setCameras(availableCameras);
      }

      if (availableCameras.length === 0) {
        setStatus('no-camera');
        return;
      }

      const targetId = deviceId ?? availableCameras[Math.min(cameraIndex, availableCameras.length - 1)]?.id;

      await instance.start(
        targetId ? { deviceId: { exact: targetId } } : { facingMode: 'environment' },
        {
          fps: 12,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const size = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.7);
            return { width: size, height: size };
          },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          if (hasScannedRef.current) return;
          hasScannedRef.current = true;
          onScan(decodedText);
        },
        () => {
          // Per-frame "no code found" callback — expected constantly while scanning, ignore.
        }
      );

      setStatus('scanning');

      try {
        const capabilities = instance.getRunningTrackCameraCapabilities();
        setTorchSupported(Boolean(capabilities?.torchFeature().isSupported()));
      } catch {
        setTorchSupported(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/permission|denied|NotAllowed/i.test(message)) {
        setStatus('denied');
      } else if (/NotFound|no camera/i.test(message)) {
        setStatus('no-camera');
      } else {
        setStatus('error');
        setErrorDetail(message);
      }
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    startScanner();
    return () => {
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleTorch = async () => {
    const instance = scannerRef.current;
    if (!instance) return;
    try {
      const capabilities = instance.getRunningTrackCameraCapabilities();
      await capabilities?.torchFeature().apply(!torchOn);
      setTorchOn(!torchOn);
    } catch {
      // Torch toggling isn't guaranteed on all devices — fail quietly.
    }
  };

  const switchCamera = () => {
    if (cameras.length < 2) return;
    const nextIndex = (cameraIndex + 1) % cameras.length;
    setCameraIndex(nextIndex);
    setTorchOn(false);
    startScanner(cameras[nextIndex].id);
  };

  const handleClose = async () => {
    await stopScanner();
    onClose();
  };

  return createPortal(
    <div className="admin-modal-overlay" style={{ zIndex: 120 }}>
      <div
        className="glass-panel admin-modal-panel"
        style={{
          maxWidth: '480px',
          width: '100%',
          border: '1px solid rgba(0, 208, 132, 0.4)',
          padding: '1.5rem',
        }}
      >
        <button
          onClick={handleClose}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: 'rgba(255, 255, 255, 0.05)',
            border: 'none',
            color: '#94A3B8',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2,
          }}
        >
          <X size={18} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', paddingRight: '2.75rem' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'rgba(0, 208, 132, 0.15)',
              color: '#00D084',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ScanLine size={24} />
          </div>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--txt-primary)' }}>Scan Barcode / QR</h3>
            <div style={{ fontSize: '0.8rem', color: '#64748B' }}>Arahkan kamera ke label SKU atau QR spare part</div>
          </div>
        </div>

        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '1 / 1',
            borderRadius: '16px',
            overflow: 'hidden',
            background: '#000',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div
            id={SCANNER_ELEMENT_ID}
            style={{ width: '100%', height: '100%' }}
          />

          {status === 'scanning' && (
            <>
              {/* Corner brackets */}
              {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).map((corner) => {
                const isTop = corner.startsWith('top');
                const isLeft = corner.endsWith('left');
                return (
                  <div
                    key={corner}
                    style={{
                      position: 'absolute',
                      width: '34px',
                      height: '34px',
                      pointerEvents: 'none',
                      top: isTop ? '14%' : undefined,
                      bottom: !isTop ? '14%' : undefined,
                      left: isLeft ? '14%' : undefined,
                      right: !isLeft ? '14%' : undefined,
                      borderTop: isTop ? '3px solid #00D084' : undefined,
                      borderBottom: !isTop ? '3px solid #00D084' : undefined,
                      borderLeft: isLeft ? '3px solid #00D084' : undefined,
                      borderRight: !isLeft ? '3px solid #00D084' : undefined,
                      borderRadius: '4px',
                    }}
                  />
                );
              })}
              {/* Animated scan line */}
              <div className="barcode-scan-line" />
            </>
          )}

          {status === 'starting' && (
            <div style={overlayCenterStyle}>
              <Loader2 size={30} color="#00D084" className="spin-icon" />
              <div style={{ color: '#94A3B8', fontSize: '0.85rem', marginTop: '0.75rem' }}>Mengaktifkan kamera...</div>
            </div>
          )}

          {status === 'denied' && (
            <div style={overlayCenterStyle}>
              <CameraOff size={30} color="#F87171" />
              <div style={{ color: '#F87171', fontWeight: 700, fontSize: '0.9rem', marginTop: '0.75rem' }}>
                Akses kamera ditolak
              </div>
              <div style={{ color: '#94A3B8', fontSize: '0.78rem', marginTop: '0.35rem', maxWidth: '260px' }}>
                Izinkan akses kamera di pengaturan browser, lalu coba lagi.
              </div>
              <button onClick={() => startScanner()} style={retryButtonStyle}>
                <RefreshCcw size={14} /> Coba Lagi
              </button>
            </div>
          )}

          {status === 'no-camera' && (
            <div style={overlayCenterStyle}>
              <CameraOff size={30} color="#F59E0B" />
              <div style={{ color: '#F59E0B', fontWeight: 700, fontSize: '0.9rem', marginTop: '0.75rem' }}>
                Kamera tidak ditemukan
              </div>
              <div style={{ color: '#94A3B8', fontSize: '0.78rem', marginTop: '0.35rem', maxWidth: '260px' }}>
                Perangkat ini tidak memiliki kamera yang bisa diakses, atau sedang dipakai aplikasi lain.
              </div>
            </div>
          )}

          {status === 'error' && (
            <div style={overlayCenterStyle}>
              <CameraOff size={30} color="#F87171" />
              <div style={{ color: '#F87171', fontWeight: 700, fontSize: '0.9rem', marginTop: '0.75rem' }}>
                Gagal membuka kamera
              </div>
              <div style={{ color: '#64748B', fontSize: '0.72rem', marginTop: '0.35rem', maxWidth: '280px', wordBreak: 'break-word' }}>
                {errorDetail}
              </div>
              <button onClick={() => startScanner()} style={retryButtonStyle}>
                <RefreshCcw size={14} /> Coba Lagi
              </button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
            {status === 'scanning' ? 'Posisikan barcode di dalam bingkai hijau' : ' '}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {cameras.length > 1 && status === 'scanning' && (
              <button onClick={switchCamera} style={iconButtonStyle} title="Ganti kamera">
                <RefreshCcw size={16} />
              </button>
            )}
            {torchSupported && status === 'scanning' && (
              <button onClick={toggleTorch} style={iconButtonStyle} title="Senter">
                {torchOn ? <Flashlight size={16} color="#00D084" /> : <FlashlightOff size={16} />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

const overlayCenterStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  padding: '1.5rem',
  background: 'rgba(10, 15, 29, 0.9)',
};

const retryButtonStyle: React.CSSProperties = {
  marginTop: '1rem',
  display: 'flex',
  alignItems: 'center',
  gap: '0.4rem',
  background: 'rgba(0, 208, 132, 0.12)',
  border: '1px solid rgba(0, 208, 132, 0.4)',
  color: '#00D084',
  borderRadius: '8px',
  padding: '0.5rem 0.9rem',
  fontSize: '0.8rem',
  fontWeight: 600,
  cursor: 'pointer',
};

const iconButtonStyle: React.CSSProperties = {
  width: '36px',
  height: '36px',
  borderRadius: '8px',
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255, 255, 255, 0.05)',
  color: '#94A3B8',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};