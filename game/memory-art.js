/** Original procedural art. No remote assets. Call on browser main thread after DOM exists.
 * rainGroup/windmillGroup use local origin at water/ground level; host positions them.
 * update takes absolute elapsed seconds and story flags, not delta time.
 */
export function createMemoryProps(T) {
  const makeCanvas = () => {
    const c = document.createElement("canvas");
    c.width = 768;
    c.height = 512;
    return [c, c.getContext("2d")];
  };
  function paper(ctx) {
    ctx.fillStyle = "#f1e8d5";
    ctx.fillRect(0, 0, 768, 512);
    for (let i = 0; i < 1700; i++) {
      const x = (i * 137.21) % 768,
        y = (i * 71.73) % 512;
      ctx.fillStyle = i % 2 ? "rgba(133,104,67,.035)" : "rgba(255,255,255,.2)";
      ctx.fillRect(x, y, 1 + (i % 3), 1);
    }
    ctx.strokeStyle = "#c9bda6";
    ctx.lineWidth = 2;
    ctx.strokeRect(18, 18, 732, 476);
  }
  function cloud(c, x, y, s) {
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    c.beginPath();
    c.moveTo(-78, 18);
    c.bezierCurveTo(-108, -8, -72, -38, -45, -24);
    c.bezierCurveTo(-48, -68, 24, -77, 37, -36);
    c.bezierCurveTo(78, -52, 107, -8, 79, 16);
    c.bezierCurveTo(43, 28, -35, 25, -78, 18);
    c.fillStyle = "#b0cbd8";
    c.fill();
    c.strokeStyle = "#698ea7";
    c.lineWidth = 3;
    c.stroke();
    c.restore();
  }
  function fish(c, x, y, s) {
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    c.beginPath();
    c.moveTo(-40, 0);
    c.lineTo(-73, -27);
    c.quadraticCurveTo(-62, 0, -73, 25);
    c.closePath();
    c.fillStyle = "#cf9c47";
    c.fill();
    c.beginPath();
    c.ellipse(0, 0, 48, 25, -0.06, 0, Math.PI * 2);
    c.fillStyle = "#e3b65e";
    c.fill();
    c.strokeStyle = "#a87d3c";
    c.lineWidth = 2;
    c.stroke();
    c.beginPath();
    c.moveTo(-5, 0);
    c.quadraticCurveTo(17, -17, 12, 11);
    c.stroke();
    c.beginPath();
    c.arc(29, -7, 3, 0, Math.PI * 2);
    c.fillStyle = "#5e625f";
    c.fill();
    c.restore();
  }
  const [letter, lc] = makeCanvas();
  paper(lc);
  cloud(lc, 607, 94, 0.55);
  fish(lc, 630, 168, 0.55);
  lc.fillStyle = "#505e67";
  lc.font = '28px "Noto Sans CJK SC", "Microsoft YaHei", sans-serif';
  [
    "你好，邮差。",
    "我想带我的小鱼出去玩一次。",
    "它每天都在等我放学。",
  ].forEach((line, i) => lc.fillText(line, 65, 237 + i * 58));
  const [drawing, dc] = makeCanvas();
  paper(dc);
  dc.fillStyle = "#dce5e5";
  dc.fillRect(44, 44, 680, 424);
  cloud(dc, 224, 158, 0.92);
  cloud(dc, 536, 129, 0.7);
  cloud(dc, 410, 234, 0.48);
  dc.strokeStyle = "#91b4c2";
  dc.lineWidth = 3;
  for (let i = 0; i < 4; i++) {
    dc.beginPath();
    dc.moveTo(80, 344 + i * 16);
    dc.bezierCurveTo(240, 319 + i * 16, 442, 376 + i * 16, 690, 340 + i * 16);
    dc.stroke();
  }
  fish(dc, 390, 337, 1.22);
  dc.fillStyle = "#677e8c";
  dc.font = '24px "Noto Sans CJK SC", "Microsoft YaHei", sans-serif';
  dc.fillText("这样，你就能每天都看见云了。", 140, 432);
  const tex = (c) => {
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = 2;
    return t;
  };
  const letterTexture = tex(letter),
    drawingTexture = tex(drawing);
  const rainGroup = new T.Group();
  rainGroup.name = "OptionalRainGarden";
  const water = new T.MeshStandardMaterial({
    color: 0xa8cbd4,
    roughness: 0.24,
    metalness: 0.05,
    transparent: true,
    opacity: 0.68,
  });
  const drops = [];
  for (let i = 0; i < 7; i++) {
    const d = new T.Mesh(new T.SphereGeometry(0.09, 10, 8), water);
    d.scale.y = 1.5;
    rainGroup.add(d);
    drops.push(d);
  }
  const pool = new T.Mesh(
    new T.TorusGeometry(0.65, 0.025, 8, 32),
    new T.MeshStandardMaterial({ color: 0xb7d8de, roughness: 0.4 }),
  );
  pool.rotation.x = Math.PI / 2;
  pool.position.y = 0.08;
  rainGroup.add(pool);
  const bubbleMat = new T.MeshStandardMaterial({
    color: 0xd6e9ec,
    transparent: true,
    opacity: 0.27,
    roughness: 0.12,
    depthWrite: false,
  });
  const bubbles = [];
  for (let i = 0; i < 4; i++) {
    const b = new T.Mesh(
      new T.SphereGeometry(0.07 + i * 0.018, 12, 8),
      bubbleMat,
    );
    rainGroup.add(b);
    bubbles.push(b);
  }
  const littleFish = new T.Group();
  littleFish.name = "RainGardenFish";
  const gold = new T.MeshStandardMaterial({ color: 0xd6ad62, roughness: 0.55 });
  const torso = new T.Mesh(new T.SphereGeometry(0.11, 12, 8), gold);
  torso.scale.set(0.6, 0.8, 1.7);
  littleFish.add(torso);
  const tail = new T.Mesh(new T.ConeGeometry(0.09, 0.17, 3), gold);
  tail.rotation.x = Math.PI / 2;
  tail.position.z = -0.21;
  littleFish.add(tail);
  rainGroup.add(littleFish);
  const windmillGroup = new T.Group();
  windmillGroup.name = "OptionalPaperWindmill";
  const shaft = new T.Mesh(
    new T.CylinderGeometry(0.025, 0.035, 1.6, 8),
    new T.MeshStandardMaterial({ color: 0xb2a38b, roughness: 0.9 }),
  );
  shaft.position.y = 0.8;
  windmillGroup.add(shaft);
  const rotor = new T.Group();
  rotor.position.set(0, 1.5, 0.04);
  windmillGroup.add(rotor);
  for (let i = 0; i < 4; i++) {
    const g = new T.BufferGeometry();
    g.setAttribute(
      "position",
      new T.Float32BufferAttribute(
        [0, 0, 0.025, 0.44, 0.08, 0, 0.2, 0.4, 0.04, 0.05, 0.18, 0.13],
        3,
      ),
    );
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.computeVertexNormals();
    const blade = new T.Mesh(
      g,
      new T.MeshStandardMaterial({
        color: [0xd8d9c8, 0xb4cbd5, 0xc8b9ae, 0xe5d7b6][i],
        side: T.DoubleSide,
        roughness: 0.88,
      }),
    );
    blade.rotation.z = (i * Math.PI) / 2;
    rotor.add(blade);
  }
  rotor.add(new T.Mesh(new T.SphereGeometry(0.055, 10, 8), gold));
  let last = null,
    spin = 0;
  function update(t, { rain = false, windmill = false } = {}) {
    if (!Number.isFinite(t)) return;
    const dt = last === null ? 0 : Math.max(0, Math.min(0.1, t - last));
    last = t;
    spin += dt * (windmill ? 3.3 : 0.18);
    rotor.rotation.z = spin;
    drops.forEach((d, i) => {
      const a = (i * Math.PI * 2) / 7 + t * 0.16,
        r = rain ? 0.22 : 0.67;
      d.position.set(
        Math.cos(a) * r,
        0.22 + ((i * 0.31 + t * (rain ? 0.7 : 0.23)) % 1.2),
        Math.sin(a) * r,
      );
    });
    pool.scale.setScalar(rain ? 1 + Math.sin(t * 2) * 0.09 : 1);
    bubbles.forEach((b, i) => {
      b.visible = rain;
      b.position.set(
        Math.cos(t * 0.8 + i) * 0.52,
        0.17 + ((t * 0.23 + i * 0.24) % 1.15),
        Math.sin(t * 0.8 + i) * 0.52,
      );
    });
    littleFish.visible = rain;
    const a = t * 0.8 - 0.55;
    littleFish.position.set(Math.cos(a) * 0.52, 0.18, Math.sin(a) * 0.52);
    littleFish.rotation.y = -a;
    tail.rotation.y = Math.sin(t * 7) * 0.3;
  }
  update(0, {});
  return { letterTexture, drawingTexture, rainGroup, windmillGroup, update };
}
