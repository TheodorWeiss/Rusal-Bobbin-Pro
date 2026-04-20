import React, { useRef, useEffect } from 'react';

const PX_PER_MM = 0.4;
const PX_PER_M  = 2;

const TAIL_M = 20;

const PAD_LEFT   = 55;
const PAD_TOP    = 42;
const PAD_RIGHT  = 20;
const PAD_BOTTOM = 30;

const COLOR_CUT       = '#c0392b';
const COLOR_EDGE      = '#e6a817';
const COLOR_WASTE_BG  = '#dde0e4';
const COLOR_WASTE_HAT = '#bbbfc5';

const PALETTE_MAIN = ['#2471a3', '#1a5276', '#4a90e2', '#2e86c1', '#5dade2', '#1f618d'];
const PALETTE_SAT  = ['#1e8449', '#27ae60', '#229954', '#1d8348', '#52be80', '#17a589'];

const styles = {
    bobbinBlock: {
        background: '#fff', borderRadius: 8,
        border: '1px solid #ddd', padding: 16,
        boxShadow: '0 1px 6px rgba(0,0,0,0.08)',
        marginBottom: 20,
    },
    header: {
        display: 'flex', alignItems: 'center', flexWrap: 'wrap',
        gap: 10, marginBottom: 12,
    },
    title:  { fontWeight: 'bold', fontSize: 16, color: '#222' },
    meta:   { fontSize: 12, color: '#666' },
    badge:  { fontSize: 12, fontWeight: 'bold', padding: '3px 12px', borderRadius: 20, marginLeft: 'auto' },
    canvasWrap: {
        overflow: 'auto',
        maxHeight: '70vh',
        border: '1px solid #ccc',
        borderRadius: 4,
        background: '#fff',
    },
    metrics: {
        display: 'flex', gap: 24, flexWrap: 'wrap',
        marginTop: 12, fontSize: 13, color: '#555',
    },
    legend: { display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 10 },
};

function maxLengthM(orders) {
    if (!orders || orders.length === 0) return 0;
    return orders.reduce((m, o) => Math.max(m, o.coordinates.y_start_m + o.coordinates.length_m), 0);
}

function drawBobbin(ctx, bobbin) {
    if (!bobbin || !bobbin.source_material || !bobbin.cutting_map) return;

    const src = bobbin.source_material;
    const cfg = bobbin.layout_configuration;
    const orders = bobbin.cutting_map || [];

    const bobbinWidthMm = src.bobbin_width_mm;
    const edgeMm = cfg.edge_trim_mm;
    const interCutMm = cfg.inter_cut_mm;
    const displayLengthM = maxLengthM(orders) + TAIL_M;

    const toX = mm => PAD_LEFT + mm * PX_PER_MM;
    const toY = m => PAD_TOP + m * PX_PER_M;
    const toW = mm => mm * PX_PER_MM;
    const toH = m => m * PX_PER_M;

    const drawW = toW(bobbinWidthMm);
    const drawH = toH(displayLengthM);

    const canvasW = PAD_LEFT + drawW + PAD_RIGHT;
    const canvasH = PAD_TOP + drawH + PAD_BOTTOM;

    ctx.canvas.width = canvasW;
    ctx.canvas.height = canvasH;

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvasW, canvasH);

    ctx.fillStyle = COLOR_WASTE_BG;
    ctx.fillRect(PAD_LEFT, PAD_TOP, drawW, drawH);

    ctx.save();
    ctx.beginPath();
    ctx.rect(PAD_LEFT, PAD_TOP, drawW, drawH);
    ctx.clip();
    ctx.strokeStyle = COLOR_WASTE_HAT;
    ctx.lineWidth = 0.8;
    for (let i = -drawH; i < drawW + drawH; i += 16) {
        ctx.beginPath();
        ctx.moveTo(PAD_LEFT + i, PAD_TOP);
        ctx.lineTo(PAD_LEFT + i - drawH, PAD_TOP + drawH);
        ctx.stroke();
    }
    ctx.restore();

    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    ctx.strokeRect(PAD_LEFT, PAD_TOP, drawW, drawH);

    const edgePx = toW(edgeMm);
    ctx.fillStyle = 'rgba(230,168,23,0.22)';
    ctx.fillRect(PAD_LEFT, PAD_TOP, edgePx, drawH);
    ctx.fillRect(PAD_LEFT + drawW - edgePx, PAD_TOP, edgePx, drawH);

    ctx.strokeStyle = COLOR_EDGE;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(PAD_LEFT + edgePx, PAD_TOP);
    ctx.lineTo(PAD_LEFT + edgePx, PAD_TOP + drawH);
    ctx.moveTo(PAD_LEFT + drawW - edgePx, PAD_TOP);
    ctx.lineTo(PAD_LEFT + drawW - edgePx, PAD_TOP + drawH);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#7a5c00';
    ctx.font = 'bold 9px Arial';
    ctx.fillText(`кромка ${edgeMm}мм`, PAD_LEFT + 4, PAD_TOP + 14);
    ctx.fillText(`кромка ${edgeMm}мм`, PAD_LEFT + drawW - edgePx + 4, PAD_TOP + 14);

    const colorMap = {};
    let mi = 0, si = 0;
    orders.forEach(o => {
        colorMap[o.order_id] = o.type === 'main'
            ? PALETTE_MAIN[mi++ % PALETTE_MAIN.length]
            : PALETTE_SAT[si++ % PALETTE_SAT.length];
    });

    orders.forEach(order => {
        const c = order.coordinates;
        const rx = toX(c.x_start_mm);
        const ry = toY(c.y_start_m);
        const rw = toW(c.width_mm);
        const rh = toH(c.length_m);

        ctx.fillStyle = colorMap[order.order_id];
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 1;
        ctx.fillRect(rx, ry, rw, rh);
        ctx.strokeRect(rx, ry, rw, rh);

        if (rw > 30 && rh > 20) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(rx + 2, ry + 2, rw - 4, rh - 4);
            ctx.clip();

            const idSize = Math.min(11, Math.max(8, rh / 6));
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${idSize}px Arial`;
            const idW = ctx.measureText(order.order_id).width;
            if (idW < rw - 8) {
                ctx.fillText(order.order_id, rx + rw / 2 - idW / 2, ry + rh / 2 + idSize * 0.35);
            }

            const dimStr = `${c.width_mm}×${c.length_m}`;
            const dimSize = Math.max(7, idSize - 2);
            ctx.font = `${dimSize}px Arial`;
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            const dimW = ctx.measureText(dimStr).width;
            if (rh > idSize * 2 + 8 && dimW < rw - 8) {
                ctx.fillText(dimStr, rx + rw / 2 - dimW / 2, ry + rh / 2 + idSize * 0.35 + dimSize + 2);
            }

            const prioStr = `П${order.priority}`;
            ctx.font = `bold 8px Arial`;
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.fillText(prioStr, rx + 4, ry + 12);

            ctx.restore();
        }
    });

    //вертикальные
    for (let i = 0; i < orders.length; i++) {
        for (let j = i + 1; j < orders.length; j++) {
            const a = orders[i].coordinates;
            const b = orders[j].coordinates;

            const a_y1 = a.y_start_m;
            const a_y2 = a.y_start_m + a.length_m;
            const b_y1 = b.y_start_m;
            const b_y2 = b.y_start_m + b.length_m;
            const yOverlap = (a_y1 < b_y2 && b_y1 < a_y2);

            if (yOverlap) {
                const a_x1 = a.x_start_mm;
                const a_x2 = a.x_start_mm + a.width_mm;
                const b_x1 = b.x_start_mm;
                const b_x2 = b.x_start_mm + b.width_mm;

                if (a_x2 < b_x1) {
                    const gap = b_x1 - a_x2;
                    // Рисуем рез только если зазор равен interCutMm (с погрешностью 1мм)
                    if (Math.abs(gap - interCutMm) < 1 && gap > 0) {
                        const cutX = a_x2 + gap / 2;
                        const cutXPx = toX(cutX);
                        const cutY1 = Math.max(a_y1, b_y1);
                        const cutY2 = Math.min(a_y2, b_y2);
                        const cutY1Px = toY(cutY1);
                        const cutY2Px = toY(cutY2);

                        ctx.fillStyle = 'rgba(192,57,43,0.25)';
                        ctx.fillRect(cutXPx - 2, cutY1Px, 4, cutY2Px - cutY1Px);

                        ctx.strokeStyle = COLOR_CUT;
                        ctx.lineWidth = 1.5;
                        ctx.setLineDash([5, 4]);
                        ctx.beginPath();
                        ctx.moveTo(cutXPx, cutY1Px);
                        ctx.lineTo(cutXPx, cutY2Px);
                        ctx.stroke();
                        ctx.setLineDash([]);

                        ctx.fillStyle = COLOR_CUT;
                        ctx.font = 'bold 8px Arial';
                        ctx.fillText(`рез ${interCutMm}`, cutXPx - 12, cutY1Px + 12);
                    }
                } else if (b_x2 < a_x1) {
                    const gap = a_x1 - b_x2;
                    if (Math.abs(gap - interCutMm) < 1 && gap > 0) {
                        const cutX = b_x2 + gap / 2;
                        const cutXPx = toX(cutX);
                        const cutY1 = Math.max(a_y1, b_y1);
                        const cutY2 = Math.min(a_y2, b_y2);
                        const cutY1Px = toY(cutY1);
                        const cutY2Px = toY(cutY2);

                        ctx.fillStyle = 'rgba(192,57,43,0.25)';
                        ctx.fillRect(cutXPx - 2, cutY1Px, 4, cutY2Px - cutY1Px);

                        ctx.strokeStyle = COLOR_CUT;
                        ctx.lineWidth = 1.5;
                        ctx.setLineDash([5, 4]);
                        ctx.beginPath();
                        ctx.moveTo(cutXPx, cutY1Px);
                        ctx.lineTo(cutXPx, cutY2Px);
                        ctx.stroke();
                        ctx.setLineDash([]);

                        ctx.fillStyle = COLOR_CUT;
                        ctx.font = 'bold 8px Arial';
                        ctx.fillText(`рез ${interCutMm}`, cutXPx - 12, cutY1Px + 12);
                    }
                }
            }
        }
    }

    //горизонтальные
    for (let i = 0; i < orders.length; i++) {
        for (let j = i + 1; j < orders.length; j++) {
            const a = orders[i].coordinates;
            const b = orders[j].coordinates;

            // Проверяем пересечение по X (на одной вертикальной полосе)
            const a_x1 = a.x_start_mm;
            const a_x2 = a.x_start_mm + a.width_mm;
            const b_x1 = b.x_start_mm;
            const b_x2 = b.x_start_mm + b.width_mm;
            const xOverlap = (a_x1 < b_x2 && b_x1 < a_x2);

            if (!xOverlap) continue;

            // Определяем, какой заказ сверху, какой снизу
            const a_y1 = a.y_start_m;
            const a_y2 = a.y_start_m + a.length_m;
            const b_y1 = b.y_start_m;
            const b_y2 = b.y_start_m + b.length_m;

            let top, bottom;
            if (a_y2 < b_y1) {
                top = a;
                bottom = b;
                const gap = b_y1 - a_y2;
                // Проверяем, что зазор РАВЕН interCutM
                const interCutM = interCutMm / 1000;
                if (Math.abs(gap - interCutM) < 0.001 && gap > 0) {
                    const cutY = a_y2 + gap / 2;
                    const cutYPx = toY(cutY);
                    const cutX1 = Math.max(a_x1, b_x1);
                    const cutX2 = Math.min(a_x2, b_x2);
                    const cutX1Px = toX(cutX1);
                    const cutX2Px = toX(cutX2);

                    ctx.fillStyle = 'rgba(192,57,43,0.25)';
                    ctx.fillRect(cutX1Px, cutYPx - 2, cutX2Px - cutX1Px, 4);

                    ctx.strokeStyle = COLOR_CUT;
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([5, 4]);
                    ctx.beginPath();
                    ctx.moveTo(cutX1Px, cutYPx);
                    ctx.lineTo(cutX2Px, cutYPx);
                    ctx.stroke();
                    ctx.setLineDash([]);

                    ctx.fillStyle = COLOR_CUT;
                    ctx.font = 'bold 8px Arial';
                    ctx.fillText(`рез ${interCutMm}мм`, cutX2Px + 5, cutYPx + 3);
                }
            } else if (b_y2 < a_y1) {
                top = b;
                bottom = a;
                const gap = a_y1 - b_y2;
                if (Math.abs(gap - interCutMm) < 0.5 && gap > 0) {
                    const cutY = b_y2 + gap / 2;
                    const cutYPx = toY(cutY);
                    const cutX1 = Math.max(a_x1, b_x1);
                    const cutX2 = Math.min(a_x2, b_x2);
                    const cutX1Px = toX(cutX1);
                    const cutX2Px = toX(cutX2);

                    ctx.fillStyle = 'rgba(192,57,43,0.25)';
                    ctx.fillRect(cutX1Px, cutYPx - 2, cutX2Px - cutX1Px, 4);

                    ctx.strokeStyle = COLOR_CUT;
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([5, 4]);
                    ctx.beginPath();
                    ctx.moveTo(cutX1Px, cutYPx);
                    ctx.lineTo(cutX2Px, cutYPx);
                    ctx.stroke();
                    ctx.setLineDash([]);

                    ctx.fillStyle = COLOR_CUT;
                    ctx.font = 'bold 8px Arial';
                    ctx.fillText(`рез ${interCutMm}мм`, cutX2Px + 5, cutYPx + 3);
                }
            }
        }
    }

    ctx.strokeStyle = '#888';
    ctx.lineWidth = 0.7;
    const tickCountX = 6;
    const stepMm = bobbinWidthMm / tickCountX;
    for (let i = 0; i <= tickCountX; i++) {
        const mm = Math.round(stepMm * i);
        const px = toX(mm);
        ctx.beginPath();
        ctx.moveTo(px, PAD_TOP);
        ctx.lineTo(px, PAD_TOP - 5);
        ctx.stroke();
        ctx.fillStyle = '#333';
        ctx.font = '9px Arial';
        ctx.fillText(`${mm}`, px - 8, PAD_TOP - 7);
    }
    ctx.fillStyle = '#555';
    ctx.font = 'bold 9px Arial';
    ctx.fillText('ширина (мм) →', PAD_LEFT + drawW / 2 - 30, 14);

    const tickCountY = Math.max(5, Math.min(15, Math.floor(displayLengthM / 100)));
    const stepM = displayLengthM / tickCountY;
    for (let i = 0; i <= tickCountY; i++) {
        const m = Math.round(stepM * i);
        const py = toY(m);
        ctx.beginPath();
        ctx.moveTo(PAD_LEFT - 5, py);
        ctx.lineTo(PAD_LEFT, py);
        ctx.stroke();
        ctx.fillStyle = '#333';
        ctx.font = '9px Arial';
        ctx.fillText(`${m}м`, PAD_LEFT - 32, py + 3);
    }

    ctx.save();
    ctx.translate(14, PAD_TOP + drawH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#555';
    ctx.font = 'bold 9px Arial';
    ctx.fillText('длина (м) ↓', -40, 0);
    ctx.restore();
}

function LegendItem({ color, border, hatch, label }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
                width: 16, height: 12, borderRadius: 2, flexShrink: 0, display: 'inline-block',
                background: hatch
                    ? `repeating-linear-gradient(45deg,${COLOR_WASTE_HAT} 0,${COLOR_WASTE_HAT} 1px,${color} 0,${color} 50%)`
                    : color,
                backgroundSize: hatch ? '6px 6px' : undefined,
                border: `1px solid ${border || 'transparent'}`,
            }} />
            <span style={{ fontSize: 12, color: '#444' }}>{label}</span>
        </div>
    );
}

function SingleBobbin({ bobbin }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        if (!bobbin?.cutting_map) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        drawBobbin(ctx, bobbin);
    }, [bobbin]);

    const eff = bobbin.efficiency_metrics || {};
    const cfg = bobbin.layout_configuration || {};

    return (
        <div style={styles.bobbinBlock}>
            <div style={styles.header}>
                <span style={styles.title}>{bobbin.bobbin_id || bobbin.source_material.alloy}</span>
                <span style={styles.meta}>
                    {bobbin.source_material.alloy} · {bobbin.source_material.thickness_um} мкм ·
                    ширина {bobbin.source_material.bobbin_width_mm} мм ·
                    длина {bobbin.source_material.bobbin_length_m} м
                </span>
                <span style={{
                    ...styles.badge,
                    background: eff.waste_percentage <= 15 ? '#d4edda' : '#fce4e4',
                    color: eff.waste_percentage <= 15 ? '#155724' : '#721c24',
                }}>
                    отходы {eff.waste_percentage?.toFixed(1)}%
                    {eff.waste_percentage <= 15 ? ' ✅' : ' ⚠️'}
                </span>
            </div>

            <div style={styles.canvasWrap}>
                <canvas ref={canvasRef} style={{ display: 'block' }} />
            </div>

            <div style={styles.metrics}>
                <span>Заказов: <b>{bobbin.cutting_map.length}</b></span>
                <span>Межкройный рез: <b>{cfg.inter_cut_mm} мм</b></span>
                <span>Кромка: <b>{cfg.edge_trim_mm} мм</b></span>
            </div>

            <div style={styles.legend}>
                <LegendItem color={PALETTE_MAIN[0]} label="Основной заказ" />
                <LegendItem color={PALETTE_SAT[0]} label="Заказ-спутник" />
                <LegendItem color="rgba(192,57,43,0.25)" border={COLOR_CUT} label={`Межкройный рез ${cfg.inter_cut_mm} мм`} />
                <LegendItem color="rgba(230,168,23,0.22)" border={COLOR_EDGE} label={`Кромка ${cfg.edge_trim_mm} мм`} />
                <LegendItem color={COLOR_WASTE_BG} border="#999" hatch label="Обрезки" />
            </div>
        </div>
    );
}

function Separator({ idx }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '28px 0 14px' }}>
            <div style={{ flex: 1, height: 2, background: '#ccc', borderRadius: 1 }} />
            <span style={{
                fontSize: 13, fontWeight: 'bold', color: '#555',
                padding: '3px 16px', border: '1px solid #ccc',
                borderRadius: 20, background: '#fff', whiteSpace: 'nowrap',
            }}>
                Бобина {idx + 1}
            </span>
            <div style={{ flex: 1, height: 2, background: '#ccc', borderRadius: 1 }} />
        </div>
    );
}

const Bobbin = ({ data }) => {
    if (!data) return null;

    const bobbins = data.bobbins || [];

    if (bobbins.length === 0) {
        return <div style={{ padding: 20, textAlign: 'center' }}>Нет бобин для отображения</div>;
    }

    return (
        <div style={{ fontFamily: 'Arial, sans-serif' }}>
            {bobbins.map((bobbin, idx) => (
                <div key={bobbin.bobbin_id || idx}>
                    <Separator idx={idx} />
                    <SingleBobbin bobbin={bobbin} />
                </div>
            ))}
        </div>
    );
};

export default Bobbin;