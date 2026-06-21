<template>
  <div class="custom-card">
    <div class="match-list-header">
      <h2 class="section-title">
        <el-icon><Calendar /></el-icon>
        การแข่งขัน ({{ playedMatchesCount }}/{{ matches.length }})
      </h2>
      <div class="filter-controls">
        <el-tooltip
          content="ไม่สามารถสุ่มตารางแข่งได้เนื่องจากมีการแข่งบางแมตช์แล้ว"
          placement="top"
          :disabled="playedMatchesCount === 0"
        >
          <span>
            <el-button 
              type="warning" 
              size="small" 
              plain 
              :disabled="playedMatchesCount > 0"
              @click="shuffleMatches"
            >
              <el-icon><Refresh /></el-icon> สุ่มตารางแข่ง
            </el-button>
          </span>
        </el-tooltip>
        <el-radio-group v-model="filterActive" size="small">
          <el-radio-button value="all">ทั้งหมด</el-radio-button>
          <el-radio-button value="pending">ยังไม่แข่ง</el-radio-button>
          <el-radio-button value="completed">แข่งแล้ว</el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <!-- Match Rounds Grouping -->
    <div class="rounds-container">
      <div 
        v-for="roundNum in 6" 
        :key="roundNum" 
        v-show="hasVisibleMatches(roundNum)"
        class="round-group"
      >
        <div class="round-title">นัดที่ {{ roundNum }} {{ roundNum > 3 ? '(เลก 2)' : '(เลก 1)' }}</div>
        
        <div class="matches-list">
          <div 
            v-for="match in getMatchesByRound(roundNum)" 
            :key="match.id" 
            class="match-item-card"
            :class="{ 'is-played': match.played }"
          >
            <!-- Match Header (status & reset) -->
            <div class="match-card-top">
              <el-tag 
                :type="match.played ? 'success' : 'info'" 
                size="small" 
                effect="plain"
                class="status-tag"
              >
                {{ match.played ? 'จบเกม' : 'ยังไม่แข่ง' }}
              </el-tag>
              
              <el-button 
                v-if="match.played" 
                type="danger" 
                link
                size="small"
                @click="resetMatch(match.id)"
              >
                <el-icon><RefreshRight /></el-icon> รีเซ็ต
              </el-button>
            </div>

            <!-- Teams and Scores -->
            <div class="match-body">
              <!-- Home Team -->
              <div class="team-side home-side">
                <span class="team-color-indicator" :style="{ backgroundColor: getTeamColor(match.homeTeamId) }"></span>
                <span class="team-name text-truncate">{{ getTeamName(match.homeTeamId) }}</span>
              </div>

              <!-- Score Control Panel -->
              <div class="score-selector">
                <!-- Home Score Control -->
                <div class="score-control-group">
                  <el-button 
                    circle 
                    size="small"
                    class="control-btn"
                    :disabled="match.homeScore !== null && match.homeScore <= 0"
                    @click="adjustScore(match.id, 'home', -1)"
                  >
                    <el-icon><Minus /></el-icon>
                  </el-button>
                  
                  <span class="score-display" :class="{ 'is-empty': !match.played }">
                    {{ match.homeScore !== null ? match.homeScore : '-' }}
                  </span>
                  
                  <el-button 
                    circle 
                    size="small"
                    class="control-btn"
                    @click="adjustScore(match.id, 'home', 1)"
                  >
                    <el-icon><Plus /></el-icon>
                  </el-button>
                </div>

                <span class="vs-text">vs</span>

                <!-- Away Score Control -->
                <div class="score-control-group">
                  <el-button 
                    circle 
                    size="small"
                    class="control-btn"
                    :disabled="match.awayScore !== null && match.awayScore <= 0"
                    @click="adjustScore(match.id, 'away', -1)"
                  >
                    <el-icon><Minus /></el-icon>
                  </el-button>
                  
                  <span class="score-display" :class="{ 'is-empty': !match.played }">
                    {{ match.awayScore !== null ? match.awayScore : '-' }}
                  </span>
                  
                  <el-button 
                    circle 
                    size="small"
                    class="control-btn"
                    @click="adjustScore(match.id, 'away', 1)"
                  >
                    <el-icon><Plus /></el-icon>
                  </el-button>
                </div>
              </div>

              <!-- Away Team -->
              <div class="team-side away-side">
                <span class="team-name text-truncate">{{ getTeamName(match.awayTeamId) }}</span>
                <span class="team-color-indicator" :style="{ backgroundColor: getTeamColor(match.awayTeamId) }"></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

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

const props = defineProps<{
  matches: Match[];
  teams: Team[];
}>();

const emit = defineEmits<{
  (e: 'update-score', matchId: number, homeScore: number | null, awayScore: number | null, played: boolean): void;
  (e: 'reset-match', matchId: number): void;
  (e: 'shuffle-matches'): void;
}>();

const filterActive = ref<'all' | 'pending' | 'completed'>('all');

const playedMatchesCount = computed(() => {
  return props.matches.filter(m => m.played).length;
});

const getTeamName = (teamId: string) => {
  const team = props.teams.find(t => t.id === teamId);
  return team ? team.name : 'Unknown';
};

const getTeamColor = (teamId: string) => {
  const team = props.teams.find(t => t.id === teamId);
  return team ? team.color : '#cbd5e1';
};

const getMatchesByRound = (roundNum: number) => {
  const roundMatches = props.matches.filter(m => m.round === roundNum);
  if (filterActive.value === 'all') return roundMatches;
  if (filterActive.value === 'pending') return roundMatches.filter(m => !m.played);
  return roundMatches.filter(m => m.played);
};

const hasVisibleMatches = (roundNum: number) => {
  return getMatchesByRound(roundNum).length > 0;
};

const adjustScore = (matchId: number, side: 'home' | 'away', amount: number) => {
  const match = props.matches.find(m => m.id === matchId);
  if (!match) return;

  let newHome = match.homeScore;
  let newAway = match.awayScore;

  if (side === 'home') {
    newHome = (newHome !== null ? newHome : -1) + amount;
    if (newHome < 0) newHome = 0;
    if (newAway === null) newAway = 0; // Default other side to 0 when starting
  } else {
    newAway = (newAway !== null ? newAway : -1) + amount;
    if (newAway < 0) newAway = 0;
    if (newHome === null) newHome = 0; // Default other side to 0 when starting
  }

  emit('update-score', matchId, newHome, newAway, true);
};

const resetMatch = (matchId: number) => {
  emit('reset-match', matchId);
};

const shuffleMatches = () => {
  emit('shuffle-matches');
};
</script>

<style scoped>
.match-list-header {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
}

.filter-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

@media (min-width: 480px) {
  .match-list-header {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.15rem;
}

.rounds-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.round-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.round-title {
  font-family: var(--display-font);
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding-left: 4px;
  border-left: 3px solid #3b82f6;
  line-height: 1;
}

.matches-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.match-item-card {
  background: rgba(0, 0, 0, 0.01);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 10px 12px;
  transition: all 0.2s ease;
}

.dark-theme .match-item-card {
  background: rgba(255, 255, 255, 0.01);
}

.match-item-card.is-played {
  background: rgba(16, 185, 129, 0.02);
  border-color: rgba(16, 185, 129, 0.2);
}

.match-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.status-tag {
  font-size: 0.7rem;
}

.match-body {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.team-side {
  flex: 1 1 30%;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  font-weight: 600;
}

.home-side {
  justify-content: flex-start;
  text-align: left;
}

.away-side {
  justify-content: flex-end;
  text-align: right;
}

.text-truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 75px;
}

@media (min-width: 375px) {
  .text-truncate {
    max-width: 90px;
  }
}

@media (min-width: 480px) {
  .text-truncate {
    max-width: 120px;
  }
}

.team-color-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.score-selector {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(0, 0, 0, 0.03);
  border-radius: 20px;
  padding: 2px 6px;
}

.dark-theme .score-selector {
  background: rgba(255, 255, 255, 0.04);
}

.score-control-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.control-btn {
  width: 20px !important;
  height: 20px !important;
  padding: 0 !important;
  font-size: 0.65rem !important;
  background: transparent !important;
  border-color: var(--border-color) !important;
}

.score-display {
  font-family: var(--display-font);
  font-size: 1.1rem;
  font-weight: 700;
  width: 16px;
  text-align: center;
  color: var(--text-primary);
}

.score-display.is-empty {
  color: var(--text-muted);
}

.vs-text {
  font-size: 0.7rem;
  color: var(--text-muted);
  font-weight: 600;
  text-transform: uppercase;
  margin: 0 2px;
}
</style>
