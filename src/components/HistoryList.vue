<template>
  <div class="custom-card">
    <div class="history-header">
      <h2 class="section-title">
        <el-icon><Calendar /></el-icon>
        ประวัติการเล่น ({{ sessions.length }} สัปดาห์)
      </h2>
      <el-button type="primary" size="small" @click="$emit('add-session')">
        <el-icon><Plus /></el-icon> เพิ่มสัปดาห์ใหม่
      </el-button>
    </div>
    <p class="section-desc">รายการสรุปผลคะแนนประจำสัปดาห์ที่เคยเล่นมาทั้งหมด</p>

    <div v-if="sessions.length === 0" class="no-history">
      <el-empty description="ยังไม่มีประวัติการแข่ง" />
    </div>

    <div v-else class="sessions-timeline">
      <div 
        v-for="session in sortedSessions" 
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
import { computed } from 'vue';
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

// Sort sessions from newest to oldest
const sortedSessions = computed(() => {
  return [...props.sessions].sort((a, b) => b.date.localeCompare(a.date));
});

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
</style>
