import * as T from "./vendor/three.module.js";
export function createSky(scene) {
  const clouds = [];
  new T.TextureLoader().load(
    "../asset-recovery/cloud-study/cloud-soft.png",
    (tex) => {
      tex.colorSpace = T.SRGBColorSpace;
      for (const [x, y, z, w, h, opacity] of [
        [-5.3, 0.15, -4.2, 7, 2.7, 0.65],
        [4.4, 0.5, -9.3, 8, 2.9, 0.42],
      ]) {
        const c = new T.Sprite(
          new T.SpriteMaterial({
            map: tex,
            color: 0xc0cedc,
            opacity,
            transparent: true,
            depthWrite: false,
            depthTest: true,
            fog: true,
          }),
        );
        c.position.set(x, y, z);
        c.scale.set(w, h, 1);
        scene.add(c);
        clouds.push(c);
      }
    },
  );
  const uniforms = { map: { value: null }, warm: { value: 0 } };
  const mat = new T.ShaderMaterial({
    side: T.BackSide,
    depthWrite: false,
    uniforms,
    vertexShader:
      "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader: `uniform sampler2D map;uniform float warm;varying vec2 vUv;void main(){vec3 n=texture2D(map,vUv).rgb;float cloud=clamp((dot(n,vec3(.333))-.15)*1.5,0.,1.);vec3 dawn=mix(vec3(.60,.64,.75),vec3(.83,.73,.70),1.-vUv.y);dawn+=cloud*.08;gl_FragColor=vec4(mix(n,dawn,warm),1.);
#include <colorspace_fragment>
}`,
    toneMapped: false,
    fog: false,
  });
  const sphere = new T.Mesh(new T.SphereGeometry(140, 48, 24), mat);
  sphere.visible = false;
  sphere.renderOrder = -100;
  scene.add(sphere);
  new T.TextureLoader().load("./assets/sky-night.png", (t) => {
    t.colorSpace = T.SRGBColorSpace;
    uniforms.map.value = t;
    sphere.visible = true;
  });
  return {
    get ready() {
      return !!uniforms.map.value;
    },
    update(x, y, z, warm) {
      sphere.position.set(x, y, z);
      uniforms.warm.value = warm;
    },
    sphere,
  };
}
