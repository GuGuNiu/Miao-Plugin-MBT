<template>
  <div ref="reactRoot"></div>
</template>
<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import React from 'react';
import { createRoot } from 'react-dom/client';
const props = defineProps({
  component: {
    type: Function,
    required: true
  },
  componentProps: {
    type: Object,
    default: () => ({})
  }
});
const reactRoot = ref(null);
let root = null;
const renderReact = () => {
  if (root) {
    root.render(React.createElement(props.component, props.componentProps));
  }
};
onMounted(() => {
  if (reactRoot.value) {
    root = createRoot(reactRoot.value);
    renderReact();
  }
});
watch(() => props.componentProps, renderReact, { deep: true });
onUnmounted(() => {
  if (root) {
    root.unmount();
  }
});
</script>
