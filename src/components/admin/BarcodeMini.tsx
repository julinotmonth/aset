import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeMiniProps {
  value: string;
  height?: number;
  width?: number;
  fontSize?: number;
}

/**
 * Renders a compact Code128 barcode inline (e.g. inside a table row).
 * Always drawn on a literal white background with black bars — regardless
 * of the app's light/dark theme — because a barcode must stay high-contrast
 * black-on-white to remain scannable by real scanners/cameras.
 */
export const BarcodeMini: React.FC<BarcodeMiniProps> = ({ value, height = 30, width = 1.4, fontSize = 10 }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    try {
      JsBarcode(svgRef.current, value, {
        format: 'CODE128',
        displayValue: true,
        fontSize,
        height,
        width,
        margin: 4,
        background: '#FFFFFF',
        lineColor: '#0A0F1D',
      });
    } catch {
      /* invalid characters for barcode — fail silently, SKU still shown as text elsewhere */
    }
  }, [value, height, width, fontSize]);

  return (
    <div style={{ display: 'inline-block', background: '#FFFFFF', borderRadius: '6px', padding: '2px 4px', lineHeight: 0, maxWidth: '100%' }}>
      <svg ref={svgRef} style={{ maxWidth: '100%', height: 'auto' }} />
    </div>
  );
};