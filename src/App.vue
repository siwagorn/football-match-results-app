<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import TeamConfig from './components/TeamConfig.vue';
import MatchList from './components/MatchList.vue';
import StandingsTable from './components/StandingsTable.vue';
import HistoryList from './components/HistoryList.vue';
import { supabase } from './supabaseClient';
import { parseLineRoster, generateWeeklyShareText, generateMonthlyShareText } from './utils/parser';
import type { Team, Match, GameSession, StandingRow } from './utils/parser';
import html2canvas from 'html2canvas';

// ----------------------------------------------------
// STATE MANAGEMENT & LOCAL STORAGE & SUPABASE
// ----------------------------------------------------

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const correctPasscode = import.meta.env.VITE_ADMIN_PASSCODE || '1234';
const appName = import.meta.env.VITE_APP_NAME || 'เตะบอลวันอังคาร Match Day';

const activeTab = ref<'standings' | 'matches' | 'history' | 'teams' | 'settings'>('standings');
const isDark = ref(true); // Default to Dark Mode for high-end aesthetics

const teams = ref<Team[]>([]);
const sessions = ref<GameSession[]>([]);
const activeSessionId = ref<string>('');

// Standing Views State
const standingViewType = ref<'weekly' | 'monthly' | 'alltime'>('weekly');
const selectedMonth = ref<string>(new Date().toISOString().slice(0, 7)); // Default: current month

// Admin Verification States
const adminPasscode = ref(localStorage.getItem('football_app_admin_passcode') || '');
const isAdmin = computed(() => !correctPasscode || adminPasscode.value === correctPasscode);
const isLoading = ref(false);

// LINE Import and Roster States
const importDialogVisible = ref(false);
const lineImportText = ref('');

// Sharing Dialog States
const shareDialogVisible = ref(false);
const shareText = ref('');

const defaultTeams: Team[] = [
  { id: 'team-1', name: 'ทีมสีน้ำเงิน', color: '#3b82f6' },
  { id: 'team-2', name: 'ทีมสีแดง', color: '#ef4444' },
  { id: 'team-3', name: 'ทีมสีเขียว', color: '#10b981' },
  { id: 'team-4', name: 'ทีมสีเหลือง', color: '#f59e0b' }
];

const generateInitialMatches = (currentTeams: Team[]): Match[] => {
  const t1 = currentTeams[0].id;
  const t2 = currentTeams[1].id;
  const t3 = currentTeams[2].id;
  const t4 = currentTeams[3].id;

  return [
    // Round 1
    { id: 1, round: 1, homeTeamId: t1, awayTeamId: t2, homeScore: null, awayScore: null, played: false },
    { id: 2, round: 1, homeTeamId: t3, awayTeamId: t4, homeScore: null, awayScore: null, played: false },
    
    // Round 2
    { id: 3, round: 2, homeTeamId: t1, awayTeamId: t3, homeScore: null, awayScore: null, played: false },
    { id: 4, round: 2, homeTeamId: t2, awayTeamId: t4, homeScore: null, awayScore: null, played: false },
    
    // Round 3
    { id: 5, round: 3, homeTeamId: t1, awayTeamId: t4, homeScore: null, awayScore: null, played: false },
    { id: 6, round: 3, homeTeamId: t2, awayTeamId: t3, homeScore: null, awayScore: null, played: false },
    
    // Round 4 (Leg 2 - reverse home/away)
    { id: 7, round: 4, homeTeamId: t2, awayTeamId: t1, homeScore: null, awayScore: null, played: false },
    { id: 8, round: 4, homeTeamId: t4, awayTeamId: t3, homeScore: null, awayScore: null, played: false },
    
    // Round 5 (Leg 2)
    { id: 9, round: 5, homeTeamId: t3, awayTeamId: t1, homeScore: null, awayScore: null, played: false },
    { id: 10, round: 5, homeTeamId: t4, awayTeamId: t2, homeScore: null, awayScore: null, played: false },
    
    // Round 6 (Leg 2)
    { id: 11, round: 6, homeTeamId: t4, awayTeamId: t1, homeScore: null, awayScore: null, played: false },
    { id: 12, round: 6, homeTeamId: t3, awayTeamId: t2, homeScore: null, awayScore: null, played: false }
  ];
};

const saveToLocalStorageOnly = () => {
  localStorage.setItem('football_app_teams', JSON.stringify(teams.value));
  localStorage.setItem('football_app_sessions_v2', JSON.stringify(sessions.value));
  localStorage.setItem('football_app_active_session_id', activeSessionId.value);
};

const saveAdminPasscode = (val: string) => {
  localStorage.setItem('football_app_admin_passcode', val);
  if (val === correctPasscode) {
    ElMessage.success('เข้าสู่โหมดผู้ดูแลระบบเรียบร้อยแล้ว!');
  }
};

const checkAdminAndExecute = (action: () => void) => {
  if (!isAdmin.value) {
    ElMessageBox.alert('สิทธิ์ของคุณคือผู้เข้าชมเท่านั้น (Read-Only) กรุณาใส่รหัสผ่านผู้ดูแลที่ถูกต้องในหน้าตั้งค่า เพื่อดำเนินการแก้ไขข้อมูล', 'สิทธิ์ไม่เพียงพอ', {
      confirmButtonText: 'ตกลง',
      type: 'warning'
    });
    return false;
  }
  action();
  return true;
};

// Supabase synchronization helpers
const saveSessionToSupabase = async (session: GameSession) => {
  if (!supabaseUrl || !supabaseAnonKey) return;
  try {
    const { error } = await supabase
      .from('sessions')
      .upsert({
        id: session.id,
        name: session.name,
        date: session.date,
        month: session.month,
        matches: session.matches,
        team_players: session.teamPlayers || {},
        created_at: new Date(parseInt(session.id.split('-')[1]) || Date.now()).toISOString()
      });
    if (error) throw error;
  } catch (err) {
    console.error('Failed to save session to Supabase:', err);
  }
};

const saveTeamsToSupabase = async (updatedTeams: Team[]) => {
  if (!supabaseUrl || !supabaseAnonKey) return;
  try {
    const promises = updatedTeams.map(t => 
      supabase.from('teams').upsert({
        id: t.id,
        name: t.name,
        color: t.color,
        updated_at: new Date().toISOString()
      })
    );
    await Promise.all(promises);
  } catch (err) {
    console.error('Failed to save teams to Supabase:', err);
  }
};

const deleteSessionFromSupabase = async (sessionId: string) => {
  if (!supabaseUrl || !supabaseAnonKey) return;
  try {
    const { error } = await supabase
      .from('sessions')
      .delete()
      .eq('id', sessionId);
    if (error) throw error;
  } catch (err) {
    console.error('Failed to delete session from Supabase:', err);
  }
};

const loadLocalStorageFallback = () => {
  const savedTeams = localStorage.getItem('football_app_teams');
  if (savedTeams) {
    teams.value = JSON.parse(savedTeams);
  } else {
    teams.value = [...defaultTeams];
  }

  const savedSessions = localStorage.getItem('football_app_sessions_v2');
  const savedActiveId = localStorage.getItem('football_app_active_session_id');

  if (savedSessions && savedActiveId) {
    sessions.value = JSON.parse(savedSessions);
    activeSessionId.value = savedActiveId;
  } else {
    const firstSession: GameSession = {
      id: `session-${Date.now()}`,
      name: 'สัปดาห์ที่ 1',
      date: new Date().toISOString().slice(0, 10),
      month: new Date().toISOString().slice(0, 7),
      matches: generateInitialMatches(teams.value),
      teamPlayers: {}
    };
    sessions.value = [firstSession];
    activeSessionId.value = firstSession.id;
    saveToLocalStorageOnly();
  }
};

const fetchFromSupabase = async () => {
  if (!supabaseUrl || !supabaseAnonKey) {
    loadLocalStorageFallback();
    return;
  }
  isLoading.value = true;
  try {
    // Fetch teams
    const { data: teamsData, error: teamsError } = await supabase
      .from('teams')
      .select('*')
      .order('id', { ascending: true });
    
    if (teamsError) throw teamsError;
    if (teamsData && teamsData.length > 0) {
      teams.value = teamsData.map(t => ({ id: t.id, name: t.name, color: t.color }));
    } else {
      teams.value = [...defaultTeams];
      await saveTeamsToSupabase(teams.value);
    }

    // Fetch sessions
    const { data: sessionsData, error: sessionsError } = await supabase
      .from('sessions')
      .select('*')
      .order('created_at', { ascending: true });

    if (sessionsError) throw sessionsError;
    if (sessionsData && sessionsData.length > 0) {
      sessions.value = sessionsData.map(s => ({
        id: s.id,
        name: s.name,
        date: s.date,
        month: s.month,
        matches: s.matches,
        teamPlayers: s.team_players
      }));
      const savedActiveId = localStorage.getItem('football_app_active_session_id');
      if (savedActiveId && sessions.value.some(s => s.id === savedActiveId)) {
        activeSessionId.value = savedActiveId;
      } else {
        activeSessionId.value = sessions.value[sessions.value.length - 1].id;
      }
    } else {
      const firstSession: GameSession = {
        id: `session-${Date.now()}`,
        name: 'สัปดาห์ที่ 1',
        date: new Date().toISOString().slice(0, 10),
        month: new Date().toISOString().slice(0, 7),
        matches: generateInitialMatches(teams.value),
        teamPlayers: {}
      };
      sessions.value = [firstSession];
      activeSessionId.value = firstSession.id;
      await saveSessionToSupabase(firstSession);
    }
    saveToLocalStorageOnly();
  } catch (err) {
    console.error('Supabase fetch error, falling back to LocalStorage:', err);
    ElMessage.warning('ไม่สามารถเชื่อมต่อ Cloud ได้ กำลังใช้ข้อมูลสำรองในเครื่องนี้แทน');
    loadLocalStorageFallback();
  } finally {
    isLoading.value = false;
  }
};

// ----------------------------------------------------
// THEME MANAGEMENT
// ----------------------------------------------------

const applyTheme = () => {
  if (isDark.value) {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.add('dark-theme');
  } else {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.remove('dark-theme');
  }
};

const toggleTheme = () => {
  isDark.value = !isDark.value;
  applyTheme();
};

// ----------------------------------------------------
// GETTERS & ACTIVE SESSION COMPUTED
// ----------------------------------------------------

const activeSession = computed(() => {
  return sessions.value.find(s => s.id === activeSessionId.value) || null;
});

const activeSessionMatches = computed(() => {
  return activeSession.value ? activeSession.value.matches : [];
});

const activeSessionName = computed(() => {
  return activeSession.value ? activeSession.value.name : '';
});

// Available months for filtering
const availableMonths = computed(() => {
  const months = new Set<string>();
  sessions.value.forEach(s => {
    if (s.month) months.add(s.month);
  });
  if (months.size === 0) {
    months.add(new Date().toISOString().slice(0, 7));
  }
  return Array.from(months).sort().reverse();
});

const formatMonthThai = (monthStr: string) => {
  if (!monthStr) return '';
  const [year, month] = monthStr.split('-');
  const monthNames = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  const thaiYear = parseInt(year) + 543;
  return `${monthNames[parseInt(month) - 1]} ${thaiYear}`;
};

const selectedMonthLabel = computed(() => {
  return formatMonthThai(selectedMonth.value);
});

// ----------------------------------------------------
// CALCULATE DYNAMIC STANDINGS
// ----------------------------------------------------

const calculateStandings = (sessionsToAggregate: GameSession[]) => {
  const list = teams.value.map(t => ({
    teamId: t.id,
    name: t.name,
    color: t.color,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDiff: 0,
    points: 0
  }));

  sessionsToAggregate.forEach(session => {
    session.matches.forEach(m => {
      if (!m.played || m.homeScore === null || m.awayScore === null) return;
      
      const homeRow = list.find(r => r.teamId === m.homeTeamId);
      const awayRow = list.find(r => r.teamId === m.awayTeamId);
      if (!homeRow || !awayRow) return;

      homeRow.played++;
      awayRow.played++;

      homeRow.goalsFor += m.homeScore;
      homeRow.goalsAgainst += m.awayScore;
      awayRow.goalsFor += m.awayScore;
      awayRow.goalsAgainst += m.homeScore;

      if (m.homeScore > m.awayScore) {
        homeRow.won++;
        homeRow.points += 3;
        awayRow.lost++;
      } else if (m.homeScore < m.awayScore) {
        awayRow.won++;
        awayRow.points += 3;
        homeRow.lost++;
      } else {
        homeRow.drawn++;
        homeRow.points += 1;
        awayRow.drawn++;
        awayRow.points += 1;
      }
    });
  });

  list.forEach(r => {
    r.goalDiff = r.goalsFor - r.goalsAgainst;
  });

  // Sort: Points -> Goal Difference -> Goals For -> Alphabetical name fallback
  list.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.name.localeCompare(b.name);
  });

  return list;
};

const standings = computed(() => {
  if (standingViewType.value === 'weekly') {
    return activeSession.value ? calculateStandings([activeSession.value]) : [];
  } else if (standingViewType.value === 'monthly') {
    const monthlySessions = sessions.value.filter(s => s.month === selectedMonth.value);
    return calculateStandings(monthlySessions);
  } else {
    return calculateStandings(sessions.value);
  }
});

// ----------------------------------------------------
// DYNAMIC STATISTICS (WOW FACTOR WIDGETS)
// ----------------------------------------------------

const activeSessionsForStats = computed(() => {
  if (standingViewType.value === 'weekly') {
    return activeSession.value ? [activeSession.value] : [];
  } else if (standingViewType.value === 'monthly') {
    return sessions.value.filter(s => s.month === selectedMonth.value);
  } else {
    return sessions.value;
  }
});

const playedMatchesCount = computed(() => {
  return activeSessionsForStats.value.reduce((acc, s) => acc + s.matches.filter(m => m.played).length, 0);
});

const totalMatchesCount = computed(() => {
  return activeSessionsForStats.value.length * 12;
});

const totalGoals = computed(() => {
  return activeSessionsForStats.value.reduce((acc, s) => {
    return acc + s.matches.reduce((sum, m) => {
      if (m.played) {
        return sum + (m.homeScore || 0) + (m.awayScore || 0);
      }
      return sum;
    }, 0);
  }, 0);
});

const averageGoals = computed(() => {
  if (playedMatchesCount.value === 0) return '0.0';
  return (totalGoals.value / playedMatchesCount.value).toFixed(1);
});

const leadingTeam = computed(() => {
  if (standings.value.length === 0 || playedMatchesCount.value === 0) return null;
  return standings.value[0];
});

// ----------------------------------------------------
// ACTIONS & HANDLERS
// ----------------------------------------------------

const handleUpdateScore = (matchId: number, homeScore: number | null, awayScore: number | null, played: boolean) => {
  checkAdminAndExecute(() => {
    if (!activeSession.value) return;
    const match = activeSession.value.matches.find(m => m.id === matchId);
    if (match) {
      match.homeScore = homeScore;
      match.awayScore = awayScore;
      match.played = played;
      saveToLocalStorageOnly();
      saveSessionToSupabase(activeSession.value);
    }
  });
};

const handleResetMatch = (matchId: number) => {
  checkAdminAndExecute(() => {
    if (!activeSession.value) return;
    const match = activeSession.value.matches.find(m => m.id === matchId);
    if (match) {
      match.homeScore = null;
      match.awayScore = null;
      match.played = false;
      saveToLocalStorageOnly();
      saveSessionToSupabase(activeSession.value);
      ElMessage.info('รีเซ็ตผลการแข่งขันแล้ว');
    }
  });
};

const handleShuffleMatches = () => {
  checkAdminAndExecute(() => {
    if (!activeSession.value) return;
    
    // Check if any match in the session is played
    const hasPlayedMatches = activeSession.value.matches.some(m => m.played);
    if (hasPlayedMatches) {
      ElMessage.warning('ไม่สามารถสุ่มตารางได้เนื่องจากมีการแข่งบางแมตช์เริ่มเล่นไปแล้ว');
      return;
    }

    const shuffleArray = <T>(array: T[]): T[] => {
      const arr = [...array];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    };

    const isSameSchedule = (matchesA: Match[], matchesB: Match[]) => {
      if (matchesA.length !== matchesB.length) return false;
      return matchesA.every((m, idx) => m.homeTeamId === matchesB[idx].homeTeamId && m.awayTeamId === matchesB[idx].awayTeamId);
    };

    let shuffledTeams = [...teams.value];
    let newMatches = generateInitialMatches(shuffledTeams);
    let attempts = 0;
    
    // Attempt to shuffle until we get a different schedule, up to 10 attempts
    while (isSameSchedule(activeSession.value.matches, newMatches) && attempts < 10) {
      shuffledTeams = shuffleArray(teams.value);
      newMatches = generateInitialMatches(shuffledTeams);
      attempts++;
    }

    activeSession.value.matches = newMatches;
    
    saveToLocalStorageOnly();
    saveSessionToSupabase(activeSession.value);
    ElMessage.success('สุ่มและจัดตารางการแข่งขันใหม่เรียบร้อยแล้ว!');
  });
};

const handleTeamsUpdate = (updatedTeams: Team[]) => {
  checkAdminAndExecute(() => {
    teams.value = updatedTeams;
    saveToLocalStorageOnly();
    saveTeamsToSupabase(updatedTeams);
  });
};

const handleAddSession = () => {
  checkAdminAndExecute(() => {
    const nextIndex = sessions.value.length + 1;
    const nextDate = new Date();
    const nextDateStr = nextDate.toISOString().slice(0, 10);
    const nextMonthStr = nextDate.toISOString().slice(0, 7);

    const newSession: GameSession = {
      id: `session-${Date.now()}`,
      name: `สัปดาห์ที่ ${nextIndex}`,
      date: nextDateStr,
      month: nextMonthStr,
      matches: generateInitialMatches(teams.value),
      teamPlayers: {}
    };

    sessions.value.push(newSession);
    activeSessionId.value = newSession.id;
    activeTab.value = 'matches'; // Jump directly to matches
    saveToLocalStorageOnly();
    saveSessionToSupabase(newSession);
    ElMessage.success(`สร้าง "${newSession.name}" เรียบร้อยแล้ว!`);
  });
};

const handleSelectSession = (sessionId: string) => {
  activeSessionId.value = sessionId;
  activeTab.value = 'matches'; // Open match sheet
  localStorage.setItem('football_app_active_session_id', sessionId);
  ElMessage.success(`เปิดใช้งาน: ${activeSessionName.value}`);
};

const handleDeleteSession = (sessionId: string) => {
  checkAdminAndExecute(() => {
    if (sessions.value.length <= 1) {
      ElMessage.warning('ไม่สามารถลบสัปดาห์สุดท้ายได้ อย่างน้อยต้องเหลือ 1 สัปดาห์');
      return;
    }

    sessions.value = sessions.value.filter(s => s.id !== sessionId);

    // If we deleted the active session, fallback to the first available session
    if (activeSessionId.value === sessionId) {
      activeSessionId.value = sessions.value[0].id;
    }

    saveToLocalStorageOnly();
    deleteSessionFromSupabase(sessionId);
    ElMessage.success('ลบสัปดาห์เรียบร้อยแล้ว');
  });
};

const handleResetAllData = () => {
  checkAdminAndExecute(() => {
    ElMessageBox.confirm(
      'คุณแน่ใจหรือไม่ที่จะลบทุกอย่าง? ข้อมูลสัปดาห์และทีมบน Cloud และเครื่องนี้จะกลับเป็นค่าเริ่มต้น',
      'ล้างข้อมูลระบบทั้งหมด',
      {
        confirmButtonText: 'ล้างข้อมูลทั้งหมด',
        cancelButtonText: 'ยกเลิก',
        type: 'warning',
        confirmButtonClass: 'el-button--danger'
      }
    ).then(async () => {
      localStorage.removeItem('football_app_teams');
      localStorage.removeItem('football_app_sessions_v2');
      localStorage.removeItem('football_app_active_session_id');
      
      if (supabaseUrl && supabaseAnonKey) {
        try {
          isLoading.value = true;
          await supabase.from('sessions').delete().neq('id', '');
          await supabase.from('teams').delete().neq('id', '');
        } catch (err) {
          console.error(err);
        }
      }
      
      teams.value = [...defaultTeams];
      const firstSession: GameSession = {
        id: `session-${Date.now()}`,
        name: 'สัปดาห์ที่ 1',
        date: new Date().toISOString().slice(0, 10),
        month: new Date().toISOString().slice(0, 7),
        matches: generateInitialMatches(teams.value),
        teamPlayers: {}
      };
      sessions.value = [firstSession];
      activeSessionId.value = firstSession.id;
      
      saveToLocalStorageOnly();
      if (supabaseUrl && supabaseAnonKey) {
        await saveTeamsToSupabase(teams.value);
        await saveSessionToSupabase(firstSession);
      }
      
      activeTab.value = 'standings';
      ElMessage.success('ล้างฐานข้อมูลระบบและตั้งค่าเริ่มต้นเรียบร้อยแล้ว');
    }).catch(() => {}).finally(() => {
      isLoading.value = false;
    });
  });
};

// LINE Roster Import Handler
const handleImportRoster = () => {
  checkAdminAndExecute(async () => {
    if (!activeSession.value) return;
    isLoading.value = true;
    try {
      const parsedPlayers = parseLineRoster(lineImportText.value, teams.value);
      activeSession.value.teamPlayers = parsedPlayers;
      saveToLocalStorageOnly();
      await saveSessionToSupabase(activeSession.value);
      importDialogVisible.value = false;
      lineImportText.value = '';
      ElMessage.success('นำเข้ารายชื่อนักเตะสำเร็จ!');
    } catch (err) {
      console.error(err);
      ElMessage.error('เกิดข้อผิดพลาดในการนำเข้ารายชื่อ');
    } finally {
      isLoading.value = false;
    }
  });
};

// Sharing utilities
const openShareDialog = () => {
  if (standingViewType.value === 'weekly') {
    if (!activeSession.value) return;
    const weeklyStandings = standings.value as StandingRow[];
    shareText.value = generateWeeklyShareText(activeSession.value, weeklyStandings);
  } else {
    const label = standingViewType.value === 'monthly' ? selectedMonthLabel.value : 'ทั้งหมด (All-time)';
    const monthlyStandings = standings.value as StandingRow[];
    shareText.value = generateMonthlyShareText(label, monthlyStandings);
  }
  shareDialogVisible.value = true;
};

const copyShareText = () => {
  navigator.clipboard.writeText(shareText.value);
  ElMessage.success('คัดลอกข้อความสรุปคะแนนไปยังคลิปบอร์ดแล้ว!');
};

const downloadStandingsImage = async () => {
  const element = document.getElementById('standings-table-card');
  if (!element) {
    ElMessage.error('ไม่พบตารางคะแนนสำหรับส่งออกภาพ');
    return;
  }
  isLoading.value = true;
  try {
    const canvas = await html2canvas(element, {
      backgroundColor: isDark.value ? '#1e293b' : '#ffffff',
      scale: 2, // Double resolution for crystal-clarity
      logging: false,
      useCORS: true
    });
    const image = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `ตารางคะแนน_${standingViewType.value}_${new Date().toISOString().slice(0, 10)}.png`;
    link.href = image;
    link.click();
    ElMessage.success('ดาวน์โหลดรูปภาพตารางคะแนนสำเร็จ!');
  } catch (err) {
    console.error(err);
    ElMessage.error('ไม่สามารถเจเนอเรตรูปภาพได้');
  } finally {
    isLoading.value = false;
  }
};

// JSON Export/Import
const exportData = () => {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
    teams: teams.value,
    sessions: sessions.value,
    activeSessionId: activeSessionId.value
  }));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `football_planner_all_backup_${new Date().toISOString().slice(0,10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  ElMessage.success('สำรองข้อมูลเสร็จสมบูรณ์!');
};

const importData = () => {
  checkAdminAndExecute(() => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          if (data.teams && Array.isArray(data.teams) && data.sessions && Array.isArray(data.sessions)) {
            const isValidTeams = data.teams.every((t: any) => typeof t.id === 'string' && typeof t.name === 'string');
            const isValidSessions = data.sessions.every((s: any) => typeof s.id === 'string' && typeof s.name === 'string' && Array.isArray(s.matches));
            
            if (isValidTeams && isValidSessions) {
              isLoading.value = true;
              teams.value = data.teams;
              sessions.value = data.sessions;
              activeSessionId.value = data.activeSessionId || data.sessions[0].id;
              
              saveToLocalStorageOnly();
              if (supabaseUrl && supabaseAnonKey) {
                // Clear existing
                await supabase.from('sessions').delete().neq('id', '');
                await supabase.from('teams').delete().neq('id', '');
                // Upload new
                await saveTeamsToSupabase(teams.value);
                for (const s of sessions.value) {
                  await saveSessionToSupabase(s);
                }
              }
              ElMessage.success('กู้คืนข้อมูลสำเร็จ!');
            } else {
              ElMessage.error('โครงสร้างไฟล์ไม่ถูกต้อง');
            }
          } else {
            ElMessage.error('โครงสร้างไฟล์ไม่ถูกต้อง');
          }
        } catch (err) {
          console.error(err);
          ElMessage.error('ไม่สามารถอ่านไฟล์ JSON ได้');
        } finally {
          isLoading.value = false;
        }
      };
      reader.readAsText(file);
    };
    fileInput.click();
  });
};

onMounted(() => {
  fetchFromSupabase();
  applyTheme();
});
</script>

<template>
  <div class="app-container">
    <!-- Header Section -->
    <header class="header-section">
      <div>
        <h1 class="brand-title">
          <el-icon><Trophy /></el-icon>
          {{ appName }}
        </h1>
        <p class="brand-subtitle">
          จัดตารางแข่งเฉพาะกลุ่ม (กำลังแก้ไข: <strong style="color: #3b82f6;">{{ activeSessionName }}</strong>)
        </p>
      </div>
      
      <!-- Theme Switcher -->
      <el-button circle :icon="isDark ? 'Sunny' : 'Moon'" @click="toggleTheme" />
    </header>

    <!-- Tournament Overview Dashboard (WOW Factor Cards) -->
    <div v-if="activeTab === 'standings'" class="overview-grid">
      <div class="kpi-card">
        <span class="kpi-label">
          แข่งแล้ว ({{ standingViewType === 'weekly' ? 'สัปดาห์นี้' : standingViewType === 'monthly' ? 'เดือนนี้' : 'สะสม' }})
        </span>
        <span class="kpi-value font-numeric">
          {{ playedMatchesCount }} 
          <span class="kpi-unit">/ {{ totalMatchesCount }}</span>
        </span>
        <el-progress 
          v-if="totalMatchesCount > 0"
          :percentage="Math.round((playedMatchesCount / totalMatchesCount) * 100)" 
          :show-text="false"
          status="success"
          :stroke-width="4"
          style="margin-top: 8px;"
        />
      </div>

      <div class="kpi-card">
        <span class="kpi-label">จำนวนประตูรวม</span>
        <span class="kpi-value font-numeric">{{ totalGoals }}</span>
        <span class="kpi-subtext">เฉลี่ย {{ averageGoals }} ประตู/เกม</span>
      </div>

      <div v-if="leadingTeam" class="kpi-card highlight-card" :style="{ '--team-color': leadingTeam.color }">
        <span class="kpi-label">จ่าฝูงสะสม</span>
        <span class="kpi-value leading-team-name text-truncate">
          <span class="team-color-circle" :style="{ backgroundColor: leadingTeam.color }"></span>
          {{ leadingTeam.name }}
        </span>
        <span class="kpi-subtext">{{ leadingTeam.points }} คะแนน (GD {{ leadingTeam.goalDiff > 0 ? '+' + leadingTeam.goalDiff : leadingTeam.goalDiff }})</span>
      </div>
    </div>

    <!-- Main Dynamic Tab Render -->
    <main class="main-content">
      <Transition name="fade" mode="out-in">
        <div v-if="activeTab === 'standings'" key="standings">
          <!-- Standings Filter Controls -->
          <div class="standings-filters custom-card">
            <div class="filter-row-between">
              <div class="filter-row">
                <span class="filter-label">รูปแบบสรุป:</span>
                <el-radio-group v-model="standingViewType" size="small">
                  <el-radio-button value="weekly">รายสัปดาห์</el-radio-button>
                  <el-radio-button value="monthly">รายเดือน</el-radio-button>
                  <el-radio-button value="alltime">สะสมทั้งหมด</el-radio-button>
                </el-radio-group>
              </div>
              <el-button 
                type="primary" 
                size="small" 
                @click="openShareDialog"
              >
                <el-icon><Share /></el-icon> แชร์ตารางคะแนน
              </el-button>
            </div>
            
            <!-- Contextual sub-selectors -->
            <div v-if="standingViewType === 'weekly'" class="filter-row sub-row">
              <span class="filter-label">สัปดาห์:</span>
              <el-select v-model="activeSessionId" size="small" style="width: 160px;" @change="saveToLocalStorageOnly">
                <el-option 
                  v-for="session in sessions" 
                  :key="session.id" 
                  :label="session.name" 
                  :value="session.id" 
                />
              </el-select>
            </div>

            <div v-else-if="standingViewType === 'monthly'" class="filter-row sub-row">
              <span class="filter-label">เดือน:</span>
              <el-select v-model="selectedMonth" size="small" style="width: 160px;">
                <el-option 
                  v-for="m in availableMonths" 
                  :key="m" 
                  :label="formatMonthThai(m)" 
                  :value="m" 
                />
              </el-select>
            </div>
          </div>

          <StandingsTable 
            :standings="standings" 
            :view-type="standingViewType"
            :session-name="activeSessionName"
            :selected-month-label="selectedMonthLabel"
            :team-players="activeSession?.teamPlayers"
            :is-admin="isAdmin"
            @import-roster="importDialogVisible = true"
          />
        </div>
        
        <div v-else-if="activeTab === 'matches'" key="matches">
          <!-- Current Active Session Indicator -->
          <div class="session-indicator-bar custom-card">
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
              <span class="indicator-text">สัปดาห์ที่ลงคะแนนอยู่: <strong>{{ activeSessionName }}</strong></span>
              <el-button 
                type="success" 
                size="small" 
                plain
                @click="importDialogVisible = true"
              >
                <el-icon><Upload /></el-icon> นำเข้ารายชื่อจาก LINE
              </el-button>
            </div>
            <el-select v-model="activeSessionId" size="small" style="width: 130px;" @change="saveToLocalStorageOnly">
              <el-option 
                v-for="session in sessions" 
                :key="session.id" 
                :label="session.name" 
                :value="session.id" 
              />
            </el-select>
          </div>

          <MatchList 
            :matches="activeSessionMatches" 
            :teams="teams" 
            @update-score="handleUpdateScore" 
            @reset-match="handleResetMatch"
            @shuffle-matches="handleShuffleMatches"
          />
        </div>

        <div v-else-if="activeTab === 'history'" key="history">
          <HistoryList 
            :sessions="sessions" 
            :teams="teams" 
            :active-session-id="activeSessionId"
            @select-session="handleSelectSession"
            @delete-session="handleDeleteSession"
            @add-session="handleAddSession"
          />
        </div>
        
        <div v-else-if="activeTab === 'teams'" key="teams">
          <TeamConfig 
            v-model="teams" 
            @update:modelValue="handleTeamsUpdate"
          />
        </div>
        
        <div v-else-if="activeTab === 'settings'" key="settings">
          <div class="custom-card">
            <h2 class="settings-title">
              <el-icon><Setting /></el-icon>
              ตั้งค่าระบบ
            </h2>
            
            <div class="settings-options">
              <!-- Admin Passcode Verification -->
              <div class="setting-row-item">
                <div class="setting-info">
                  <span class="setting-name">สิทธิ์การแก้ไขข้อมูล (Admin Passcode)</span>
                  <span class="setting-desc">ใส่รหัสผ่านผู้ดูแลเพื่อปลดล็อกการกรอกคะแนน จัดการทีม และนำเข้ารายชื่อ</span>
                </div>
                <div style="display: flex; gap: 8px; align-items: center;">
                  <el-input 
                    v-model="adminPasscode" 
                    type="password" 
                    placeholder="ใส่รหัสผ่าน" 
                    size="small"
                    style="width: 140px;"
                    show-password
                    @input="saveAdminPasscode"
                  />
                  <el-tag :type="isAdmin ? 'success' : 'info'" size="small">
                    {{ isAdmin ? 'ปลดล็อกแล้ว' : 'อ่านอย่างเดียว' }}
                  </el-tag>
                </div>
              </div>

              <!-- Reset Button -->
              <div class="setting-row-item">
                <div class="setting-info">
                  <span class="setting-name text-danger">ล้างข้อมูลระบบทั้งหมด</span>
                  <span class="setting-desc">ลบข้อมูลสัปดาห์ รายชื่อทีม และการแข่งขันทั้งหมดเพื่อเริ่มต้นใหม่</span>
                </div>
                <el-button type="danger" plain @click="handleResetAllData">
                  <el-icon><Refresh /></el-icon> ล้างข้อมูลระบบ
                </el-button>
              </div>

              <!-- Export JSON -->
              <div class="setting-row-item">
                <div class="setting-info">
                  <span class="setting-name">ส่งออกฐานข้อมูล (Export)</span>
                  <span class="setting-desc">ดาวน์โหลดประวัติผลคะแนนทุกสัปดาห์ไว้สำรองข้อมูล</span>
                </div>
                <el-button type="primary" plain @click="exportData">
                  <el-icon><Download /></el-icon> ส่งออกข้อมูล
                </el-button>
              </div>

              <!-- Import JSON -->
              <div class="setting-row-item">
                <div class="setting-info">
                  <span class="setting-name">กู้คืนฐานข้อมูล (Import)</span>
                  <span class="setting-desc">เลือกไฟล์สำรองข้อมูล JSON เพื่อกู้ประวัติสัปดาห์คืน</span>
                </div>
                <el-button type="success" plain @click="importData">
                  <el-icon><Upload /></el-icon> นำเข้าข้อมูล
                </el-button>
              </div>
            </div>
            
            <div class="info-footer">
              <p>{{ appName }} v2.0.0 (Weekly Session Aggregator)</p>
              <p>ข้อมูลทั้งหมดบันทึกในหน่วยความจำของบราวเซอร์เครื่องนี้ (LocalStorage)</p>
            </div>
          </div>
        </div>
      </Transition>
    </main>

    <!-- Mobile-First Sticky Bottom Navigation -->
    <nav class="bottom-nav">
      <div 
        class="bottom-nav-item" 
        :class="{ active: activeTab === 'standings' }"
        @click="activeTab = 'standings'"
      >
        <el-icon><Trophy /></el-icon>
        <span>ตารางคะแนน</span>
      </div>
      
      <div 
        class="bottom-nav-item" 
        :class="{ active: activeTab === 'matches' }"
        @click="activeTab = 'matches'"
      >
        <el-icon><Calendar /></el-icon>
        <span>ผลการแข่ง</span>
      </div>

      <div 
        class="bottom-nav-item" 
        :class="{ active: activeTab === 'history' }"
        @click="activeTab = 'history'"
      >
        <el-icon><Clock /></el-icon>
        <span>ประวัติการเตะ</span>
      </div>
      
      <div 
        class="bottom-nav-item" 
        :class="{ active: activeTab === 'teams' }"
        @click="activeTab = 'teams'"
      >
        <el-icon><Avatar /></el-icon>
        <span>จัดการทีม</span>
      </div>
      
      <div 
        class="bottom-nav-item" 
        :class="{ active: activeTab === 'settings' }"
        @click="activeTab = 'settings'"
      >
        <el-icon><Setting /></el-icon>
        <span>ตั้งค่า</span>
      </div>
    </nav>

    <!-- Roster Import Dialog -->
    <el-dialog
      v-model="importDialogVisible"
      title="นำเข้ารายชื่อนักเตะจาก LINE"
      width="90%"
      style="max-width: 500px;"
      destroy-on-close
    >
      <div style="margin-bottom: 12px; font-size: 0.8rem; color: var(--text-muted);">
        วางรายชื่อที่คัดลอกมาจากห้องแชต LINE ระบบจะดึงรายชื่อแยกตามทีม 1-4 ให้โดยอัตโนมัติ
      </div>
      <el-input
        v-model="lineImportText"
        type="textarea"
        :rows="12"
        placeholder="ทีม1 🥵🔴
1.
2.
3.
4.
5.
6.
7.

ทีม2 ⚪️🖤
1.
2.
3.
4.
5.
6.
7.

ทีม3 😈🔵
1.
2.
3.
4.
5.
6.
7.

ทีม4 🟢🥦
1.
2.
3.
4.
5.
6.
7.

(โกล) เล่นฟรี
1.
2

สำรอง"
      />
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="importDialogVisible = false">ยกเลิก</el-button>
          <el-button type="primary" @click="handleImportRoster">
            ยืนยันนำเข้า
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- Share Dialog -->
    <el-dialog
      v-model="shareDialogVisible"
      title="แชร์ตารางคะแนน"
      width="90%"
      style="max-width: 500px;"
      destroy-on-close
    >
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div>
          <span style="font-weight: 600; font-size: 0.85rem; display: block; margin-bottom: 8px;">
            1. คัดลอกสรุปคะแนนสำหรับส่งห้องแชต
          </span>
          <el-input
            v-model="shareText"
            type="textarea"
            :rows="8"
            readonly
          />
          <el-button 
            type="primary" 
            size="small" 
            style="margin-top: 8px; width: 100%;" 
            @click="copyShareText"
          >
            <el-icon><CopyDocument /></el-icon> คัดลอกข้อความสรุปคะแนน
          </el-button>
        </div>
        
        <div style="border-top: 1px solid var(--border-color); padding-top: 16px;">
          <span style="font-weight: 600; font-size: 0.85rem; display: block; margin-bottom: 8px;">
            2. ดาวน์โหลดรูปภาพตารางคะแนน
          </span>
          <el-button 
            type="success" 
            size="small" 
            style="width: 100%;" 
            @click="downloadStandingsImage"
            :loading="isLoading"
          >
            <el-icon><Download /></el-icon> ดาวน์โหลดรูปภาพ PNG
          </el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped>
.overview-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

@media (min-width: 480px) {
  .overview-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.kpi-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
}

.kpi-label {
  font-size: 0.7rem;
  color: var(--text-muted);
  font-weight: 600;
  text-transform: uppercase;
}

.kpi-value {
  font-family: var(--display-font);
  font-size: 1.35rem;
  font-weight: 700;
  margin-top: 4px;
  line-height: 1.1;
  color: var(--text-primary);
}

.kpi-unit {
  font-size: 0.85rem;
  color: var(--text-muted);
  font-weight: 500;
}

.kpi-subtext {
  font-size: 0.7rem;
  color: var(--text-muted);
  margin-top: 4px;
}

.highlight-card {
  border-left: 4px solid var(--team-color, #3b82f6);
  grid-column: span 2;
}

@media (min-width: 480px) {
  .highlight-card {
    grid-column: span 1;
  }
}

.leading-team-name {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
}

.text-truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.standings-filters {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 16px;
  margin-bottom: 12px;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.filter-row-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  width: 100%;
}

.sub-row {
  border-top: 1px dashed var(--border-color);
  padding-top: 8px;
  margin-top: 4px;
}

.filter-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary);
  min-width: 76px;
}

.session-indicator-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  margin-bottom: 12px;
  font-size: 0.85rem;
}

.indicator-text strong {
  color: #3b82f6;
}

.settings-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.15rem;
  margin-bottom: 16px;
}

.settings-options {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.setting-row-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-color);
  gap: 12px;
}

.setting-row-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.setting-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
}

.setting-name {
  font-size: 0.9rem;
  font-weight: 600;
}

.text-danger {
  color: #ef4444;
}

.setting-desc {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 2px;
}

.info-footer {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
  font-size: 0.7rem;
  color: var(--text-muted);
  text-align: center;
}

.info-footer p {
  margin: 2px 0;
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
