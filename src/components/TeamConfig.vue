<template>
  <div class="custom-card">
    <h2 class="section-title">
      <el-icon><Avatar /></el-icon>
      ตั้งค่าทีม (4 ทีม)
    </h2>
    <p class="section-desc">กำหนดชื่อและสีสำหรับการแข่งขัน</p>

    <div class="team-config-list">
      <div v-for="(team, index) in localTeams" :key="team.id" class="team-config-item">
        <div class="team-label">
          <span class="team-index-tag" :style="{ backgroundColor: team.color }">{{ index + 1 }}</span>
          <span class="team-default-name">ทีม {{ index + 1 }}</span>
        </div>
        
        <div class="team-inputs">
          <el-input 
            v-model="team.name" 
            placeholder="ชื่อทีม" 
            maxlength="20"
            @input="emitUpdate"
          />
          
          <!-- Preset color selectors for mobile convenience -->
          <div class="preset-colors">
            <div 
              v-for="color in colorPresets" 
              :key="color"
              class="color-dot"
              :class="{ active: team.color === color }"
              :style="{ backgroundColor: color }"
              @click="selectColor(index, color)"
            ></div>
            
            <!-- Custom Color Picker as fallback -->
            <el-color-picker 
              v-model="team.color" 
              size="small" 
              :predefine="colorPresets"
              @change="emitUpdate"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

interface Team {
  id: string;
  name: string;
  color: string;
}

const props = defineProps<{
  modelValue: Team[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: Team[]): void;
}>();

const colorPresets = [
  '#ef4444', // Red
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Yellow
  '#8b5cf6', // Purple
  '#f97316', // Orange
  '#ec4899', // Pink
  '#64748b'  // Slate
];

// Local copy for reactive two-way binding behavior
const localTeams = ref<Team[]>(JSON.parse(JSON.stringify(props.modelValue)));

watch(() => props.modelValue, (newVal) => {
  localTeams.value = JSON.parse(JSON.stringify(newVal));
}, { deep: true });

const selectColor = (teamIndex: number, color: string) => {
  localTeams.value[teamIndex].color = color;
  emitUpdate();
};

const emitUpdate = () => {
  emit('update:modelValue', localTeams.value);
};
</script>

<style scoped>
.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.15rem;
  margin-bottom: 4px;
}

.section-desc {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-bottom: 20px;
}

.team-config-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.team-config-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 12px;
  border: 1px solid var(--border-color);
}

.dark-theme .team-config-item {
  background: rgba(255, 255, 255, 0.02);
}

.team-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.team-index-tag {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
  text-shadow: 0 1px 1px rgba(0,0,0,0.2);
}

.team-inputs {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preset-colors {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.color-dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid transparent;
  transition: transform 0.15s, border-color 0.15s;
}

.color-dot:hover {
  transform: scale(1.1);
}

.color-dot.active {
  border-color: var(--text-primary);
  transform: scale(1.05);
}

/* Custom styles override for Element Plus Color Picker in presets */
:deep(.el-color-picker__trigger) {
  width: 24px;
  height: 24px;
  padding: 0;
  border-radius: 50%;
  border: 1px solid var(--border-color);
}
</style>
