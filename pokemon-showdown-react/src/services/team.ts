import axios from 'axios';
import { authService, User } from './auth';

const API_URL = 'http://localhost:8081/api/teams';

export interface UserTeam {
  id: number;
  user_id: number;
  name: string;
  format: string;
  team_data: string; // Showdown export format
}

export const teamService = {
  getTeams: async (): Promise<UserTeam[]> => {
    const user = authService.getCurrentUser();
    if (!user) throw new Error("Not logged in");
    
    const response = await axios.get(`${API_URL}/user/${user.id}`);
    return response.data.teams || [];
  },

  saveTeam: async (name: string, format: string, teamData: string): Promise<UserTeam> => {
    const user = authService.getCurrentUser();
    if (!user) throw new Error("Not logged in");

    const response = await axios.post(API_URL, {
      user_id: user.id,
      name,
      format,
      team_data: teamData
    });
    return response.data.team;
  },

  deleteTeam: async (teamId: number): Promise<void> => {
    await axios.delete(`${API_URL}/${teamId}`);
  }
};
