/**
 * Runtime-generated icon atlas (mask icons, tinted by getColor) so the widget
 * needs no external sprite assets.
 */
const SIZE = 64;
export const ICON_NAMES = ['arrow', 'ship', 'circle', 'star', 'battle', 'siege', 'founding', 'treaty', 'disaster', 'discovery', 'note', 'pin', 'caravan', 'diamond', 'plane', 'tank'] as const;
export type IconName = (typeof ICON_NAMES)[number];

let atlas: { url: string; mapping: Record<string, any> } | null = null;

export function iconAtlas() {
  if (atlas) return atlas;
  const cols = 8;
  const rows = Math.ceil(ICON_NAMES.length / cols);
  const canvas = document.createElement('canvas');
  canvas.width = cols * SIZE;
  canvas.height = rows * SIZE;
  const ctx = canvas.getContext('2d')!;
  const mapping: Record<string, any> = {};
  ICON_NAMES.forEach((name, i) => {
    const x = (i % cols) * SIZE, y = Math.floor(i / cols) * SIZE;
    ctx.save();
    ctx.translate(x + SIZE / 2, y + SIZE / 2);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#fff';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    draw(ctx, name);
    ctx.restore();
    mapping[name] = { x, y, width: SIZE, height: SIZE, mask: true, anchorY: SIZE / 2 };
  });
  mapping.pin.anchorY = SIZE - 4;
  atlas = { url: canvas.toDataURL(), mapping };
  return atlas;
}

function star(ctx: CanvasRenderingContext2D, r1: number, r2: number, n = 5) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? r2 : r1;
    const a = (i * Math.PI) / n - Math.PI / 2;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
}

/** Draw an icon centred at the origin, `size` px tall, filled with `color`. */
export function drawIcon(ctx: CanvasRenderingContext2D, name: IconName, size: number, color: string): void {
  ctx.save();
  const s = size / SIZE;
  ctx.scale(s, s);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  draw(ctx, name, true);
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, name: IconName, direct = false) {
  switch (name) {
    case 'arrow': // chevron pointing up (north); rotated by heading
      ctx.beginPath();
      ctx.moveTo(0, -26);
      ctx.lineTo(20, 22);
      ctx.lineTo(0, 10);
      ctx.lineTo(-20, 22);
      ctx.closePath();
      ctx.fill();
      break;
    case 'ship':
      ctx.beginPath();
      ctx.moveTo(0, -28);
      ctx.quadraticCurveTo(14, -8, 11, 24);
      ctx.lineTo(-11, 24);
      ctx.quadraticCurveTo(-14, -8, 0, -28);
      ctx.fill();
      break;
    case 'circle':
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'star':
      star(ctx, 28, 12);
      ctx.fill();
      break;
    case 'battle': // crossed swords
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(-22, -22); ctx.lineTo(22, 22);
      ctx.moveTo(22, -22); ctx.lineTo(-22, 22);
      ctx.stroke();
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-26, 10); ctx.lineTo(-10, 26);
      ctx.moveTo(26, 10); ctx.lineTo(10, 26);
      ctx.stroke();
      break;
    case 'siege': // tower
      ctx.fillRect(-18, -10, 36, 36);
      for (let i = -18; i < 18; i += 12) ctx.fillRect(i, -24, 8, 14);
      break;
    case 'founding': // flag
      ctx.fillRect(-18, -28, 5, 56);
      ctx.beginPath();
      ctx.moveTo(-13, -28); ctx.lineTo(24, -16); ctx.lineTo(-13, -2);
      ctx.fill();
      break;
    case 'treaty': // scroll
      ctx.fillRect(-18, -24, 36, 48);
      cutout(ctx, direct);
      ctx.fillRect(-10, -12, 20, 4); ctx.fillRect(-10, -2, 20, 4); ctx.fillRect(-10, 8, 14, 4);
      break;
    case 'disaster': // warning triangle
      ctx.beginPath();
      ctx.moveTo(0, -28); ctx.lineTo(28, 24); ctx.lineTo(-28, 24); ctx.closePath();
      ctx.fill();
      cutout(ctx, direct);
      ctx.fillRect(-3, -10, 6, 20); ctx.fillRect(-3, 14, 6, 6);
      break;
    case 'discovery': // compass rose
      star(ctx, 28, 7, 4);
      ctx.fill();
      break;
    case 'note':
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
      break;
    case 'pin':
      ctx.beginPath();
      ctx.arc(0, -10, 18, Math.PI, 0);
      ctx.lineTo(0, 28);
      ctx.closePath();
      ctx.fill();
      cutout(ctx, direct);
      ctx.beginPath(); ctx.arc(0, -10, 7, 0, Math.PI * 2); ctx.fill();
      break;
    case 'caravan':
      ctx.beginPath(); ctx.ellipse(0, 4, 22, 14, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(14, -16, 8, 0, Math.PI * 2); ctx.fill();
      break;
    case 'plane': // top-down aircraft pointing north
      ctx.beginPath();
      ctx.moveTo(0, -28);
      ctx.quadraticCurveTo(4, -24, 4, -14);
      ctx.lineTo(4, -6);
      ctx.lineTo(28, 6);
      ctx.lineTo(28, 11);
      ctx.lineTo(4, 5);
      ctx.lineTo(3, 18);
      ctx.lineTo(11, 24);
      ctx.lineTo(11, 27);
      ctx.lineTo(0, 24);
      ctx.lineTo(-11, 27);
      ctx.lineTo(-11, 24);
      ctx.lineTo(-3, 18);
      ctx.lineTo(-4, 5);
      ctx.lineTo(-28, 11);
      ctx.lineTo(-28, 6);
      ctx.lineTo(-4, -6);
      ctx.lineTo(-4, -14);
      ctx.quadraticCurveTo(-4, -24, 0, -28);
      ctx.fill();
      break;
    case 'tank': // top-down tank, gun pointing north
      ctx.fillRect(-15, -12, 30, 36);
      ctx.fillRect(-4, -30, 8, 22);
      cutout(ctx, direct);
      ctx.beginPath();
      ctx.arc(0, 6, 8, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'diamond':
      ctx.beginPath();
      ctx.moveTo(0, -26); ctx.lineTo(20, 0); ctx.lineTo(0, 26); ctx.lineTo(-20, 0); ctx.closePath();
      ctx.fill();
      break;
  }
}

function cutout(ctx: CanvasRenderingContext2D, direct: boolean) {
  if (direct) ctx.fillStyle = 'rgba(0,0,0,0.75)';
  else ctx.globalCompositeOperation = 'destination-out';
}

export const EVENT_ICON: Record<string, IconName> = {
  battle: 'battle', siege: 'siege', founding: 'founding', treaty: 'treaty', disaster: 'disaster', discovery: 'discovery', note: 'note',
};

export const UNIT_ICON: Record<string, IconName> = {
  army: 'arrow', armor: 'tank', fleet: 'ship', ship: 'ship', aircraft: 'plane', caravan: 'caravan', explorer: 'diamond', other: 'circle',
};
