import axios from 'axios';

// Configure axios base URL
// If using Vite proxy, this can be relative path
const API_URL = 'http://localhost:8081/api/auth';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface User {
  id: number;
  username: string;
  avatar: number;
  group: number;
}

export interface LoginResponse {
  message: string;
  token: string;
  user: User;
}

export interface RegisterResponse {
  message: string;
  user: User;
}

export const authService = {
  login: async (username: string, password: string): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/login', { username, password });
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  register: async (username: string, password: string, email?: string): Promise<RegisterResponse> => {
    const response = await api.post<RegisterResponse>('/register', { username, password, email });
    return response.data;
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  getCurrentUser: (): User | null => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      return JSON.parse(userStr);
    }
    return null;
  },
  
  isAuthenticated: (): boolean => {
    return !!localStorage.getItem('token');
  }
};
