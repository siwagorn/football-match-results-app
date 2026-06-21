export interface Team {
  id: string;
  name: string;
  color: string;
}

export interface Match {
  id: number;
  round: number;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  played: boolean;
}

export interface GameSession {
  id: string;
  name: string;
  date: string;
  month: string;
  matches: Match[];
  teamPlayers?: Record<string, string[]>;
}

export interface StandingRow {
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

// LINE Text Roster Parser
export const parseLineRoster = (text: string, teams: Team[]): Record<string, string[]> => {
  const lines = text.split('\n');
  const result: Record<string, string[]> = {};
  
  // Initialize teams with empty array
  teams.forEach(t => {
    result[t.id] = [];
  });

  let currentTeamIndex = -1; // -1 means not in a team section yet

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    // Detect team header, e.g. "ทีม1", "ทีม 1", "ทีม 2", "ทีม2 🥵🔴"
    // Regex matches "ทีม" followed by 1, 2, 3, or 4
    const teamHeaderMatch = line.match(/ทีม\s*([1-4])/i);
    if (teamHeaderMatch) {
      currentTeamIndex = parseInt(teamHeaderMatch[1]) - 1;
      continue;
    }

    // Stop parsing if we hit other sections
    if (line.includes('(โกล)') || line.includes('สำรอง') || line.startsWith('เตะบอล') || line.startsWith('-')) {
      currentTeamIndex = -1;
      continue;
    }

    // If we are currently inside a valid team section (0 to 3)
    if (currentTeamIndex >= 0 && currentTeamIndex < teams.length) {
      // Clean player name, e.g., "2.หมี" or "4. กิต" -> "หมี", "กิต"
      // Match a number followed by dot, then anything
      const playerMatch = line.match(/^\d+\s*\.\s*(.*)$/);
      let playerName = '';
      if (playerMatch) {
        playerName = playerMatch[1].trim();
      } else {
        playerName = line.trim();
      }

      if (playerName) {
        const teamId = teams[currentTeamIndex].id;
        result[teamId].push(playerName);
      }
    }
  }

  return result;
};

// Generate Weekly Summary Text
export const generateWeeklyShareText = (session: GameSession, standings: StandingRow[]): string => {
  let text = `🏆 สรุปตารางคะแนน: ${session.name}\n`;
  text += `--------------------------------\n`;
  
  standings.forEach((row, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '⚽';
    text += `${medal} อันดับ ${index + 1}: ${row.name}\n`;
    text += `   แข่ง ${row.played} | ชนะ ${row.won} เสมอ ${row.drawn} แพ้ ${row.lost}\n`;
    text += `   ได้/เสีย: ${row.goalsFor}/${row.goalsAgainst} (ต่าง ${row.goalDiff > 0 ? '+' + row.goalDiff : row.goalDiff})\n`;
    text += `   แต้มรวม: ${row.points} คะแนน\n\n`;
  });
  
  text += `เปิดดูผลคะแนนเรียลไทม์: ${window.location.origin}`;
  return text;
};

// Generate Monthly Summary Text
export const generateMonthlyShareText = (monthLabel: string, standings: StandingRow[]): string => {
  let text = `🏆 ตารางคะแนนสะสมรายเดือน: ${monthLabel}\n`;
  text += `--------------------------------\n`;
  
  standings.forEach((row, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '⚽';
    text += `${medal} อันดับ ${index + 1}: ${row.name}\n`;
    text += `   แข่ง ${row.played} | ชนะ ${row.won} เสมอ ${row.drawn} แพ้ ${row.lost}\n`;
    text += `   ได้/เสีย: ${row.goalsFor}/${row.goalsAgainst} (ต่าง ${row.goalDiff > 0 ? '+' + row.goalDiff : row.goalDiff})\n`;
    text += `   แต้มรวม: ${row.points} คะแนน\n\n`;
  });
  
  text += `เปิดดูตารางคะแนนย้อนหลัง: ${window.location.origin}`;
  return text;
};
