import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Button, Menu, Tooltip } from 'antd';
import { LogoutOutlined } from '@ant-design/icons';
import Login from './pages/Login';
import Register from './pages/Register';
import Chat from './pages/Chat';
import { authService } from './services/auth';

const { Header, Content, Footer } = Layout;

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = authService.isAuthenticated();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

const MainLayout: React.FC = () => {
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(authService.isAuthenticated());

  useEffect(() => {
    setIsAuthenticated(authService.isAuthenticated());
  }, [location.pathname]);

  const handleLogout = () => {
    authService.logout();
    window.location.href = '/login';
  };

  return (
    <Layout className="layout" style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="demo-logo" style={{ color: 'white', fontSize: '20px', fontWeight: 'bold' }}>
          Pokemon Battle
        </div>
        {isAuthenticated && (
          <Tooltip title="退出登录">
            <Button type="primary" danger shape="circle" icon={<LogoutOutlined />} onClick={handleLogout} />
          </Tooltip>
        )}
      </Header>
      <Content style={{ padding: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 64px - 70px)' }}>
        <div className="site-layout-content" style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Routes>
            <Route path="/login" element={
              <div style={{ padding: '50px' }}><Login /></div>
            } />
            <Route path="/register" element={
              <div style={{ padding: '50px' }}><Register /></div>
            } />
            <Route path="/" element={
              <PrivateRoute>
                <Chat />
              </PrivateRoute>
            } />
          </Routes>
        </div>
      </Content>
      <Footer style={{ textAlign: 'center' }}>
        Pokemon Battle ©2024 Created by Open Source Community
      </Footer>
    </Layout>
  );
};

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <MainLayout />
    </Router>
  );
}

export default App;
