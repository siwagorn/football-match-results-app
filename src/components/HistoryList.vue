<template>
  <div class="custom-card">
    <div class="history-header">
      <h2 class="section-title">
        <el-icon><Calendar /></el-icon>
        ประวัติการเล่น (แสดง {{ displayedSessions.length }} จาก {{ sessions.length }} สัปดาห์)
      </h2>
      <el-button type="primary" size="small" @click="$emit('add-session')">
        <el-icon><Plus /></el-icon> เพิ่มสัปดาห์ใหม่
      </el-button>
    </div>
    <p class="section-desc">รายการสรุปผลคะแนนประจำสัปดาห์ที่เคยเล่นมาทั้งหมด</p>

    <!-- Filters Section -->
    <div v-if="sessions.length > 0" class="history-filters-box">
      <div class="filters-header">
        <span class="filters-title">
          <el-icon><Filter /></el-icon> ตัวกรองข้อมูลประวัติ
        </span>
        <el-button 
          v-if="hasActiveFilters" 
          type="warning" 
          size="small" 
          link 
          @click="clearFilters"
        >
          <el-icon><Refresh /></el-icon> ล้างตัวกรอง
        </el-button>
      </div>
      
      <div class="filters-grid">
        <!-- Date Range Filter -->
        <div class="filter-item daterange-item">
          <span class="filter-item-label">เลือกช่วงวันที่:</span>
          <el-date-picker
            v-model="filterDateRange"
            type="daterange"
            range-separator="ถึง"
            start-placeholder="เริ่มต้น"
            end-placeholder="สิ้นสุด"
            size="small"
            style="width: 100%"
            clearable
          />
        </div>

        <!-- Year Filter -->
        <div class="filter-item">
          <span class="filter-item-label">ปีการแข่งขัน:</span>
          <el-select v-model="filterYear" size="small" style="width: 100%">
            <el-option label="ทั้งหมด" value="all" />
            <el-option 
              v-for="year in availableYears" 
              :key="year" 
              :label="parseInt(year) + 543" 
              :value="year" 
            />
          </el-select>
        </div>

        <!-- Month Filter -->
        <div class="filter-item">
          <span class="filter-item-label">เดือน:</span>
          <el-select v-model="filterMonth" size="small" style="width: 100%">
            <el-option label="ทั้งหมด" value="all" />
            <el-option 
              v-for="m in thaiMonths" 
              :key="m.value" 
              :label="m.label" 
              :value="m.value" 
            />
          </el-select>
        </div>

        <!-- Limit Filter -->
        <div class="filter-item limit-item">
          <span class="filter-item-label">จำนวนที่แสดง:</span>
          <el-radio-group v-model="displayLimit" size="small" style="width: 100%">
            <el-radio-button :value="5">5 เกมล่าสุด</el-radio-button>
            <el-radio-button :value="10">10 เกม</el-radio-button>
            <el-radio-button :value="20">20 เกม</el-radio-button>
            <el-radio-button value="all">ทั้งหมด</el-radio-button>
          </el-radio-group>
        </div>
      </div>
    </div>

    <div v-if="sessions.length === 0" class="no-history">
      <el-empty description="ยังไม่มีประวัติการแข่ง" />
    </div>

    <div v-else-if="displayedSessions.length === 0" class="no-history">
      <el-empty description="ไม่พบประวัติการแข่งที่ตรงกับเงื่อนไขตัวกรอง" />
    </div>

    <div v-else class="sessions-timeline">
      <div 
        v-for="session in displayedSessions" 
        :key="session.id" 
        class="session-card"
        :class="{ 'is-active': session.id === activeSessionId }"
      >
        <div class="session-card-header">
          <div>
            <span class="session-active-indicator" v-if="session.id === activeSessionId">
              <el-tag size="small" effect="dark" type="primary">กำลังใช้งาน</el-tag>
            </span>
            <h3 class="session-name">{{ session.name }}</h3>
            <span class="session-date font-numeric">{{ formatDate(session.date) }}</span>
          </div>
          
          <div class="session-actions">
            <el-button 
              type="primary" 
              size="small" 
              plain
              @click="$emit('select-session', session.id)"
            >
              เปิดดู
            </el-button>
            <el-button 
              type="danger" 
              size="small" 
              link 
              @click="confirmDelete(session)"
            >
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </div>

        <!-- Mini Standings Preview -->
        <div class="mini-standings">
          <div class="mini-standings-title">สรุปอันดับ:</div>
          <div class="mini-standings-grid">
            <div 
              v-for="(row, idx) in getSessionStandings(session)" 
              :key="row.teamId"
              class="mini-standing-row"
            >
              <span class="mini-rank">{{ idx + 1 }}.</span>
              <span class="mini-team-color" :style="{ backgroundColor: row.color }"></span>
              <span class="mini-team-name text-truncate">{{ row.name }}</span>
              <span class="mini-team-points font-numeric font-bold">{{ row.points }} แต้ม</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { ElMessageBox } from 'element-plus';

interface Team {
  id: string;
  name: string;
  color: string;
}

interface Match {
  id: number;
  round: number;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  played: boolean;
}

interface GameSession {
  id: string;
  name: string;
  date: string;
  month: string;
  matches: Match[];
}

const props = defineProps<{
  sessions: GameSession[];
  teams: Team[];
  activeSessionId: string;
}>();

const emit = defineEmits<{
  (e: 'select-session', sessionId: string): void;
  (e: 'delete-session', sessionId: string): void;
  (e: 'add-session'): void;
}>();

// Filter states
const filterYear = ref<string>('all');
const filterMonth = ref<string>('all');
const filterDateRange = ref<[Date, Date] | null>(null);
const displayLimit = ref<number | 'all'>(5);

// Get available years from sessions
const availableYears = computed(() => {
  const years = new Set<string>();
  props.sessions.forEach(s => {
    if (s.date) {
      const year = s.date.split('-')[0];
      if (year) years.add(year);
    }
  });
  return Array.from(years).sort((a, b) => b.localeCompare(a));
});

const thaiMonths = [
  { value: '01', label: 'มกราคม' },
  { value: '02', label: 'กุมภาพันธ์' },
  { value: '03', label: 'มีนาคม' },
  { value: '04', label: 'เมษายน' },
  { value: '05', label: 'พฤษภาคม' },
  { value: '06', label: 'มิถุนายน' },
  { value: '07', label: 'กรกฎาคม' },
  { value: '08', label: 'สิงหาคม' },
  { value: '09', label: 'กันยายน' },
  { value: '10', label: 'ตุลาคม' },
  { value: '11', label: 'พฤศจิกายน' },
  { value: '12', label: 'ธันวาคม' }
];

// Sort sessions from newest to oldest
const sortedSessions = computed(() => {
  return [...props.sessions].sort((a, b) => b.date.localeCompare(a.date));
});

// Filter sessions
const filteredSessions = computed(() => {
  return sortedSessions.value.filter(session => {
    // Year filter
    if (filterYear.value !== 'all') {
      const year = session.date.split('-')[0];
      if (year !== filterYear.value) return false;
    }
    
    // Month filter
    if (filterMonth.value !== 'all') {
      const month = session.date.split('-')[1];
      if (month !== filterMonth.value) return false;
    }
    
    // Date range filter
    if (filterDateRange.value && filterDateRange.value.length === 2) {
      const sDate = new Date(session.date);
      sDate.setHours(0, 0, 0, 0);
      
      const start = new Date(filterDateRange.value[0]);
      start.setHours(0, 0, 0, 0);
      
      const end = new Date(filterDateRange.value[1]);
      end.setHours(23, 59, 59, 999);
      
      if (sDate < start || sDate > end) return false;
    }
    
    return true;
  });
});

// Limit display sessions
const displayedSessions = computed(() => {
  if (displayLimit.value === 'all') {
    return filteredSessions.value;
  }
  return filteredSessions.value.slice(0, displayLimit.value);
});

const hasActiveFilters = computed(() => {
  return filterYear.value !== 'all' || filterMonth.value !== 'all' || filterDateRange.value !== null;
});

const clearFilters = () => {
  filterYear.value = 'all';
  filterMonth.value = 'all';
  filterDateRange.value = null;
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('th-TH', {
    year: '2-digit',
    month: 'short',
    day: 'numeric'
  });
};

// Calculate standings for a specific session locally
const getSessionStandings = (session: GameSession) => {
  const list = props.teams.map(t => ({
    teamId: t.id,
    name: t.name,
    color: t.color,
    points: 0,
    goalDiff: 0,
    goalsFor: 0
  }));

  session.matches.forEach(m => {
    if (!m.played || m.homeScore === null || m.awayScore === null) return;
    
    const homeRow = list.find(r => r.teamId === m.homeTeamId);
    const awayRow = list.find(r => r.teamId === m.awayTeamId);
    if (!homeRow || !awayRow) return;

    homeRow.goalsFor += m.homeScore;
    homeRow.goalDiff += (m.homeScore - m.awayScore);
    awayRow.goalsFor += m.awayScore;
    awayRow.goalDiff += (m.awayScore - m.homeScore);

    if (m.homeScore > m.awayScore) {
      homeRow.points += 3;
    } else if (m.homeScore < m.awayScore) {
      awayRow.points += 3;
    } else {
      homeRow.points += 1;
      awayRow.points += 1;
    }
  });

  list.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.name.localeCompare(b.name);
  });

  return list;
};

const confirmDelete = (session: GameSession) => {
  ElMessageBox.confirm(
    `คุณต้องการลบข้อมูลของ "${session.name}" หรือไม่? ข้อมูลทั้งหมดของสัปดาห์นี้จะหายไปถาวร`,
    'ลบสัปดาห์การแข่งขัน',
    {
      confirmButtonText: 'ลบข้อมูล',
      cancelButtonText: 'ยกเลิก',
      type: 'warning',
      confirmButtonClass: 'el-button--danger'
    }
  ).then(() => {
    emit('delete-session', session.id);
  }).catch(() => {});
};
</script>

<style scoped>
.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.15rem;
}

.section-desc {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-bottom: 20px;
}

.no-history {
  padding: 32px 0;
}

.sessions-timeline {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.session-card {
  border: 1px solid var(--border-color);
  background: rgba(0,0,0,0.01);
  border-radius: 12px;
  padding: 16px;
  transition: all 0.2s ease;
}

.dark-theme .session-card {
  background: rgba(255,255,255,0.01);
}

.session-card.is-active {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.02);
}

.session-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
  border-bottom: 1px dashed var(--border-color);
  padding-bottom: 8px;
}

.session-name {
  font-size: 0.95rem;
  font-weight: 700;
  margin-bottom: 2px;
}

.session-date {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.session-active-indicator {
  display: inline-block;
  margin-bottom: 4px;
}

.session-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mini-standings-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 6px;
  text-transform: uppercase;
}

.mini-standings-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px 12px;
}

.mini-standing-row {
  display: flex;
  align-items: center;
  font-size: 0.8rem;
  gap: 6px;
}

.mini-rank {
  font-weight: bold;
  color: var(--text-muted);
  width: 14px;
}

.mini-team-color {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.mini-team-name {
  font-weight: 500;
  color: var(--text-primary);
  flex-grow: 1;
}

.mini-team-points {
  color: var(--text-secondary);
}

.text-truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 80px;
}

@media (min-width: 375px) {
  .text-truncate {
    max-width: 100px;
  }
}

@media (min-width: 480px) {
  .text-truncate {
    max-width: 140px;
  }
}

.font-numeric {
  font-family: var(--display-font);
}

.font-bold {
  font-weight: 700;
}

/* History Filters Styling */
.history-filters-box {
  background: rgba(0, 0, 0, 0.02);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 12px 14px;
  margin-bottom: 20px;
}

.dark-theme .history-filters-box {
  background: rgba(255, 255, 255, 0.02);
}

.filters-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 6px;
}

.filters-title {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 6px;
}

.filters-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.filter-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.filter-item-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.daterange-item, .limit-item {
  grid-column: span 2;
}

/* Deep overrides for Element Plus inside filters */
:deep(.el-range-editor.el-input__inner) {
  padding: 0 8px;
}

:deep(.el-radio-group) {
  display: flex;
  width: 100%;
}

:deep(.el-radio-button) {
  flex: 1;
}

:deep(.el-radio-button__inner) {
  width: 100%;
  padding: 8px 4px;
  font-size: 0.75rem;
  text-align: center;
}

@media (max-width: 400px) {
  :deep(.el-radio-button__inner) {
    font-size: 0.7rem;
    padding: 8px 2px;
  }
}
</style>
