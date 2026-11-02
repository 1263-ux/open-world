#!/usr/bin/env bash
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
if [[ $# -ne 2 ]]; then echo "Usage: package.sh <frozen-source> <external-work-dir>" >&2; exit 2; fi
source_root="$(cd "$1" && pwd -P)"
work="$(realpath -m "$2")"
case "$work/" in "$source_root/"*) echo 'Work directory must be outside source tree' >&2; exit 2;; esac
mkdir -p "$work"
node "$here/build.mjs" "$source_root" "$work"
node "$here/check.mjs" "$source_root" "$work"
stage="$work/snapshot"; pkg="$work/package"
rm -rf "$pkg"; mkdir -p "$pkg/data" "$pkg/licenses" "$pkg/provenance"
cp "$work/out/campus-offline.html" "$pkg/index.html"
cp "$work/out/source-fingerprints.json" "$pkg/provenance/"
cp -a "$stage/public/data/." "$pkg/data/"
cp "$source_root/node_modules/three/LICENSE" "$pkg/licenses/three-MIT.txt"
cp "$source_root/node_modules/vue/LICENSE" "$pkg/licenses/vue-MIT.txt"
cp "$source_root/games/hks/node_modules/eventemitter3/LICENSE" "$pkg/licenses/eventemitter3-MIT.txt"
cp "$stage/games/hks/PHASER-LICENSE.md" "$pkg/licenses/phaser-MIT.md"
cp "$stage/docs/resources/licenses/quaternius-characters-CC0.txt" "$pkg/licenses/quaternius-characters-CC0.txt"
cp "$stage/public/assets/environment/quaternius-license-standard.txt" "$pkg/licenses/quaternius-foliage-CC0.txt"
cp "$stage/public/models/nature/License.txt" "$pkg/licenses/kaykit-forest-CC0.txt"
cp "$stage/public/models/nature/PROVENANCE.json" "$pkg/provenance/kaykit-nature.json"
cp "$stage/public/models/nature/README.md" "$pkg/provenance/kaykit-nature-README.md"
cp "$stage/public/assets/campuses/huyu/NOTO-CJK-COPYRIGHT.txt" "$pkg/licenses/Noto-CJK-copyright.txt"
for f in MODIFICATIONS.md MODERNIZATION.md ASSET_INVENTORY.json SOURCE_INVENTORY.json MODERNIZED_INVENTORY.json; do cp "$stage/games/hks/$f" "$pkg/provenance/hks-$f"; done
while IFS= read -r -d '' file; do
  rel="${file#"$stage/public/assets/"}"
  mkdir -p "$pkg/provenance/models/$(dirname "$rel")"
  cp "$file" "$pkg/provenance/models/$rel"
done < <(find "$stage/public/assets" -name '*.metadata.json' -print0)
cat > "$pkg/README.txt" <<'EOT'
太理 · 校园漫游 — 离线试玩候选版

解压后，用现代 Chrome 或 Edge 打开 index.html；无需服务器或安装 Node。数据来源与许可在 data/ 与 licenses/；Hks 来源、修改和资源清单在 provenance/。地图数据 © OpenStreetMap contributors / Overture，ODbL 1.0；高度数据 Che et al. 3D-GloBFP，CC BY 4.0。路线为游戏设定，不是现实导航，楼高含估计。外部来源链接需要联网，但游戏资源本身应当内置。当前离线版本尚需真实 file:// 浏览器试玩验证。Hks 是用户授权直接移植的项目；不因此推定其他开放许可。
EOT
(cd "$pkg" && find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS)
(cd "$pkg" && sha256sum -c SHA256SUMS >/dev/null)
rm -f "$work/campus-offline.zip"
(cd "$pkg" && zip -q -r "$work/campus-offline.zip" .)
unzip -t "$work/campus-offline.zip" >/dev/null
printf 'Created %s\n' "$work/campus-offline.zip"
