<template>
  <div class="custom-card" id="standings-table-card">
    <h2 class="section-title">
      <el-icon><Trophy /></el-icon>
      <span v-if="viewType === 'weekly'">ตารางคะแนน: {{ sessionName || 'สัปดาห์นี้' }}</span>
      <span v-else-if="viewType === 'monthly'">ตารางคะแนนสะสม: {{ selectedMonthLabel || 'รายเดือน' }}</span>
      <span v-else>ตารางคะแนนสะสมทั้งหมด (All-time)</span>
    </h2>
    <p class="section-desc">
      <span v-if="viewType === 'weekly'">อัปเดตเรียลไทม์จากแมตช์ของสัปดาห์นี้</span>
      <span v-else-if="viewType === 'monthly'">คะแนนสะสมรวมของทุกสัปดาห์ในเดือนนี้</span>
      <span v-else>คะแนนรวมสะสมของการแข่งขันทั้งหมด</span>
    </p>

    <!-- Actions Bar: Toggle All Players & Import LINE Shortcut -->
    <div class="table-header-actions" v-if="viewType === 'weekly' && (hasAnyPlayers || isAdmin)">
      <!-- Toggle Expand All -->
      <el-button 
        v-if="hasAnyPlayers"
        type="primary" 
        link
        size="small" 
        @click="toggleExpandAll"
      >
        <el-icon><User /></el-icon>
        {{ isAllExpanded ? 'ซ่อนรายชื่อทั้งหมด' : 'แสดงรายชื่อทั้งหมด' }}
      </el-button>
      
      <!-- Import LINE Button Shortcut -->
      <el-button 
        v-if="isAdmin"
        type="success" 
        link
        size="small" 
        @click="$emit('import-roster')"
      >
        <el-icon><Upload /></el-icon> นำเข้ารายชื่อจาก LINE
      </el-button>
    </div>

    <div class="table-wrapper">
      <table class="standings-table">
        <thead>
          <tr>
            <th class="col-rank">#</th>
            <th class="col-team">ทีม</th>
            <th class="col-stat">แข่ง</th>
            <th class="col-stat hide-mobile">ชนะ</th>
            <th class="col-stat hide-mobile">เสมอ</th>
            <th class="col-stat hide-mobile">แพ้</th>
            <th class="col-stat hide-mobile">ได้</th>
            <th class="col-stat hide-mobile">เสีย</th>
            <th class="col-stat">ต่าง</th>
            <th class="col-stat col-pts">แต้ม</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="(row, idx) in standings" :key="row.teamId">
            <tr 
              class="standing-row"
              :class="{ 'leader-row': idx === 0, 'expanded-main-row': expandedTeams[row.teamId] }"
            >
              <td class="col-rank">
                <span class="rank-number" :class="'rank-' + (idx + 1)">{{ idx + 1 }}</span>
              </td>
              <td class="col-team" @click="toggleExpand(row.teamId)">
                <div class="team-cell" :class="{ 'clickable': hasPlayers(row.teamId) }">
                  <span class="team-color" :style="{ backgroundColor: row.color }"></span>
                  <span class="team-name">{{ row.name }}</span>
                  <el-icon v-if="hasPlayers(row.teamId)" class="expand-icon" :class="{ 'is-expanded': expandedTeams[row.teamId] }">
                    <ArrowRight />
                  </el-icon>
                </div>
              </td>
              <td class="col-stat font-numeric">{{ row.played }}</td>
              <td class="col-stat font-numeric hide-mobile">{{ row.won }}</td>
              <td class="col-stat font-numeric hide-mobile">{{ row.drawn }}</td>
              <td class="col-stat font-numeric hide-mobile">{{ row.lost }}</td>
              <td class="col-stat font-numeric hide-mobile">{{ row.goalsFor }}</td>
              <td class="col-stat font-numeric hide-mobile">{{ row.goalsAgainst }}</td>
              <td class="col-stat font-numeric" :class="getGdClass(row.goalDiff)">
                {{ row.goalDiff > 0 ? '+' + row.goalDiff : row.goalDiff }}
              </td>
              <td class="col-stat col-pts font-numeric font-bold">{{ row.points }}</td>
            </tr>
            
            <tr v-if="hasPlayers(row.teamId) && expandedTeams[row.teamId]" class="player-roster-row">
              <td colspan="10">
                <div class="player-tags-container">
                  <span class="player-label-prefix"><el-icon><User /></el-icon> รายชื่อ:</span>
                  <el-tag 
                    v-for="player in props.teamPlayers?.[row.teamId] || []" 
                    :key="player"
                    size="small"
                    class="player-tag-item"
                    effect="plain"
                    round
                  >
                    {{ player }}
                  </el-tag>
                </div>
              </td>
            </tr>
          </template>
          
          <tr v-if="standings.length === 0">
            <td colspan="10" class="no-data">ไม่พบข้อมูลทีม</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Standings Legend -->
    <div class="table-legend">
      <span>* เรียงลำดับตาม: คะแนน > ผลต่างประตูได้เสีย > ประตูได้</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

interface StandingRow {
  teamId: string;
  name: string;
  color: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
}

const props = defineProps<{
  standings: StandingRow[];
  viewType: 'weekly' | 'monthly' | 'alltime';
  sessionName?: string;
  selectedMonthLabel?: string;
  teamPlayers?: Record<string, string[]>;
  isAdmin?: boolean;
}>();

const emit = defineEmits<{
  (e: 'import-roster'): void;
}>();

const expandedTeams = ref<Record<string, boolean>>({});
const isAllExpanded = ref(false);

const hasPlayers = (teamId: string) => {
  return props.teamPlayers && props.teamPlayers[teamId] && props.teamPlayers[teamId].length > 0;
};

const hasAnyPlayers = computed(() => {
  if (!props.teamPlayers) return false;
  return Object.values(props.teamPlayers).some(players => players && players.length > 0);
});

const toggleExpand = (teamId: string) => {
  if (!hasPlayers(teamId)) return;
  expandedTeams.value[teamId] = !expandedTeams.value[teamId];
};

const toggleExpandAll = () => {
  isAllExpanded.value = !isAllExpanded.value;
  props.standings.forEach(row => {
    if (hasPlayers(row.teamId)) {
      expandedTeams.value[row.teamId] = isAllExpanded.value;
    }
  });
};

const getGdClass = (gd: number) => {
  if (gd > 0) return 'text-success';
  if (gd < 0) return 'text-danger';
  return '';
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
  margin-bottom: 16px;
}

.table-header-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-bottom: 10px;
  align-items: center;
}

.table-wrapper {
  overflow-x: auto;
  border-radius: 12px;
  border: 1px solid var(--border-color);
}

.standings-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.85rem;
}

.standings-table th {
  background: rgba(0, 0, 0, 0.02);
  color: var(--text-secondary);
  font-weight: 600;
  padding: 10px 8px;
  border-bottom: 1px solid var(--border-color);
  font-family: var(--display-font);
}

.dark-theme .standings-table th {
  background: rgba(255, 255, 255, 0.02);
}

.standings-table td {
  padding: 12px 8px;
  border-bottom: 1px solid var(--border-color);
  vertical-align: middle;
}

.standing-row:last-child td {
  border-bottom: none;
}

.standing-row {
  transition: background-color 0.2s ease;
}

.standing-row:hover {
  background: rgba(0, 0, 0, 0.01);
}

.dark-theme .standing-row:hover {
  background: rgba(255, 255, 255, 0.01);
}

/* Leader row highlighting */
.leader-row {
  background: rgba(59, 130, 246, 0.03);
}

.dark-theme .leader-row {
  background: rgba(59, 130, 246, 0.05);
}

.col-rank {
  width: 32px;
  text-align: center;
}

.rank-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  font-family: var(--display-font);
  font-weight: 700;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.rank-1 {
  background: #f59e0b;
  color: white;
  text-shadow: 0 1px 1px rgba(0,0,0,0.2);
}

.col-team {
  min-width: 90px;
}

.team-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.team-color {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.team-name {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100px;
}

@media (min-width: 480px) {
  .team-name {
    max-width: 150px;
  }
}

.col-stat {
  text-align: center;
  width: 36px;
}

.col-pts {
  width: 42px;
  background: rgba(0, 0, 0, 0.01);
}

.dark-theme .col-pts {
  background: rgba(255, 255, 255, 0.01);
}

.font-numeric {
  font-family: var(--display-font);
  font-size: 0.9rem;
}

.font-bold {
  font-weight: 700;
}

.text-success {
  color: #10b981;
  font-weight: 600;
}

.text-danger {
  color: #ef4444;
  font-weight: 600;
}

.no-data {
  text-align: center;
  color: var(--text-muted);
  padding: 24px;
}

.table-legend {
  font-size: 0.7rem;
  color: var(--text-muted);
  margin-top: 10px;
  text-align: right;
  font-style: italic;
}

.team-cell.clickable {
  cursor: pointer;
}

.expand-icon {
  margin-left: auto;
  font-size: 0.7rem;
  color: var(--text-muted);
  transition: transform 0.2s ease;
}

.expand-icon.is-expanded {
  transform: rotate(90deg);
  color: var(--text-primary);
}

.player-roster-row td {
  background: rgba(59, 130, 246, 0.01) !important;
  padding: 8px 12px 10px 40px !important;
  border-bottom: 1px solid var(--border-color);
}

.dark-theme .player-roster-row td {
  background: rgba(255, 255, 255, 0.01) !important;
}

.player-tags-container {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.player-label-prefix {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-right: 4px;
}

.player-tag-item {
  background: transparent !important;
  border-color: var(--border-color) !important;
  color: var(--text-secondary) !important;
}

/* Mobile Responsiveness Rules */
@media (max-width: 480px) {
  .hide-mobile {
    display: none;
  }
  
  .standings-table th, 
  .standings-table td {
    padding: 10px 4px;
  }
  
  .col-stat {
    width: 30px;
  }
  
  .col-pts {
    width: 34px;
  }
  
  .player-roster-row td {
    padding: 8px 8px 10px 16px !important;
  }
}
</style>
