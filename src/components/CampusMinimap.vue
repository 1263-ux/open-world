<script setup lang="ts">
import { computed } from 'vue';
import type { CampusData, Point2 } from '../shared/contracts';
const props = defineProps<{ campus: CampusData; position: Point2 | null; mapOpen: boolean; disabled: boolean }>();
defineEmits<{ toggle: [] }>();
const viewBox = computed(() => {
  const [minX, minZ, maxX, maxZ] = props.campus.bounds;
  const pad = 25;
  return `${minX - pad} ${minZ - pad} ${maxX - minX + pad * 2} ${maxZ - minZ + pad * 2}`;
});
function points(value: Point2[]) { return value.map(([x, z]) => `${x},${z}`).join(' '); }
const boundary = computed(() => points(props.campus.boundary));
const roads = computed(() => props.campus.roads.map(road => ({ id: road.id, points: points(road.points) })));
const features = computed(() => props.campus.features.map(feature => ({ id: feature.id, kind: feature.kind, points: points(feature.polygon) }))); 
</script>
<template>
  <button type="button" class="campus-minimap" data-testid="campus-minimap" :data-campus="campus.id" :disabled="disabled" :aria-label="mapOpen ? '关闭校园全景预览，返回人物视角' : `打开${campus.name}全景预览`" :aria-pressed="mapOpen" @click="$emit('toggle')">
    <span class="minimap-label"><b>{{ campus.name }}</b><span>{{ mapOpen ? '返回人物 ↙' : '全景预览 ↗' }}</span></span>
    <svg :viewBox="viewBox" preserveAspectRatio="xMidYMid meet" aria-hidden="true" data-testid="minimap-campus" :data-campus="campus.id">
      <polygon :points="boundary" class="minimap-boundary" />
      <polyline v-for="road in roads" :key="road.id" :points="road.points" class="minimap-road" />
      <polygon v-for="feature in features" :key="feature.id" :points="feature.points" :class="`minimap-feature ${feature.kind}`" />
      <circle v-if="position" data-testid="minimap-player" :data-x="position[0]" :data-z="position[1]" :cx="position[0]" :cy="position[1]" r="16" class="minimap-player" />
    </svg>
  </button>
</template>
