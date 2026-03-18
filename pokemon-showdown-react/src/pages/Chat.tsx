import React, { useEffect, useState, useRef } from 'react';
import { Layout, Menu, Input, List, Avatar, Typography, Button, Empty, message } from 'antd';
import { UserOutlined, MessageOutlined, TeamOutlined, SendOutlined } from '@ant-design/icons';
import { authService } from '../services/auth';

const { Sider, Content } = Layout;
const { Title, Text } = Typography;

interface ChatMessage {
  type: string;
  room: string;
  sender: string;
  target?: string;
  content: string;
  timestamp: number;
}

const Chat: React.FC = () => {
  const user = authService.getCurrentUser();
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [activeTab, setActiveTab] = useState(''); // Empty string means no tab selected initially
  const [chatVisible, setChatVisible] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const wsOpenedRef = useRef(false);
  const lastDisconnectNotifyAtRef = useRef(0);

  useEffect(() => {
    // Read user once on mount or store in a stable ref if needed,
    // but using `authService.getCurrentUser()` directly in render causes `user` object to be a new reference every render if not careful,
    // actually `authService.getCurrentUser()` parses from localStorage every time it's called!
    // This causes the component to re-render or at least `user` to change if we call it in the component body.
    // Wait, `const user = authService.getCurrentUser();` is called on every render.
    // So `user` is a new object every time.
    // The useEffect dependency `[user]` sees a new object every render, so it disconnects and reconnects constantly!
    // Let's fix this by only depending on user.username.
    const currentUsername = user?.username;
    
    if (!currentUsername) return;

    // Avoid multiple connections
    if (wsRef.current) {
        return;
    }

    const socket = new WebSocket(`ws://localhost:8082/ws?username=${currentUsername}`);
    wsRef.current = socket;
    wsOpenedRef.current = false;

    socket.onopen = () => {
      console.log('Connected to chat server');
      wsOpenedRef.current = true;
      // Send a ping or initial request if needed, but the server sends initial state on connection usually?
      // Actually our server implementation:
      // When registered, it broadcasts join message and user list.
      // But user list is broadcasted to "lobby".
      // We should wait for messages.
    };

    socket.onmessage = (event) => {
      try {
        // Handle multiple JSON objects sent in a single message (separated by newline)
        const rawData = event.data;
        const messages = rawData.split('\n').filter((msg: string) => msg.trim() !== '');
        
        for (const rawMsg of messages) {
          const msg: ChatMessage = JSON.parse(rawMsg);
          if (msg.type === 'users_update') {
            const userList = JSON.parse(msg.content);
            setUsers(userList);
          } else {
            setMessages((prev) => [...prev, msg]);
          }
        }
      } catch (e) {
        console.error("Failed to parse message", e);
      }
    };

    socket.onclose = (e) => {
      wsRef.current = null;
      // React 18 dev StrictMode can mount/unmount effects twice, and browsers can emit
      // close events like 1006/1005 before onopen. Those shouldn't show as "errors".
      if (!wsOpenedRef.current) return;

      // Ignore normal closes.
      if (e.code === 1000 || e.code === 1001) return;

      // Rate-limit the toast to avoid spam.
      const now = Date.now();
      if (now - lastDisconnectNotifyAtRef.current < 10000) return;
      lastDisconnectNotifyAtRef.current = now;

      message.error({content: '聊天服务器连接已断开', key: 'ws_disconnected', duration: 2});
    };

    setWs(socket);

    return () => {
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmounting");
        wsRef.current = null;
      }
    };
  }, [user?.username]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeTab]);

  const handleSend = () => {
    if (!inputValue.trim() || !ws) return;

    let msg: Partial<ChatMessage> = {
      content: inputValue,
      sender: user?.username || 'Unknown',
    };

    if (activeTab === 'lobby') {
      msg.type = 'chat';
      msg.room = 'lobby';
    } else {
      msg.type = 'pm';
      msg.target = activeTab.replace('pm_', '');
    }

    ws.send(JSON.stringify(msg));
    setInputValue('');
  };

  const handleMenuClick = (e: any) => {
    setActiveTab(e.key);
  };

  // Filter messages based on active tab
  const filteredMessages = messages.filter(m => {
    if (!activeTab) return false;
    if (activeTab === 'lobby') {
      return m.room === 'lobby' || m.type === 'join' || m.type === 'leave';
    } else {
      const targetUser = activeTab.replace('pm_', '');
      return m.type === 'pm' && (m.sender === targetUser || m.target === targetUser);
    }
  });

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', gap: '16px' }}>
      {/* Placeholder for Match/Battle section (Left half) */}
      <div style={{ flex: 1, background: '#f5f5f5', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Title level={4} type="secondary">匹配与对战区域 (待开发)</Title>
      </div>

      {/* Chat Section (Right half) */}
      <Layout 
        style={{ 
          width: chatVisible ? '50%' : '60px',
          minWidth: chatVisible ? '300px' : '60px',
          transition: 'all 0.3s',
          height: '100%', 
          background: '#fff', 
          borderRadius: '8px', 
          overflow: 'hidden', 
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          position: 'relative'
        }}
      >
        {!chatVisible ? (
          <div 
            style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', background: '#1890ff', color: 'white' }}
            onClick={() => setChatVisible(true)}
          >
            <MessageOutlined style={{ fontSize: '24px' }} />
          </div>
        ) : (
          <>
            <Sider width={200} theme="light" style={{ borderRight: '1px solid #f0f0f0', height: '100%' }} breakpoint="lg" collapsedWidth="0">
              <div style={{ padding: '16px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Title level={5} style={{ margin: 0 }}><MessageOutlined /> 聊天室</Title>
                <Button type="text" size="small" onClick={() => setChatVisible(false)}>收起</Button>
              </div>
              <Menu
                mode="inline"
                selectedKeys={[activeTab]}
                onClick={handleMenuClick}
                style={{ borderRight: 0, height: 'calc(100% - 60px)', overflowY: 'auto' }}
                items={[
                  {
                    key: 'lobby',
                    icon: <TeamOutlined />,
                    label: '大厅 (Lobby)'
                  },
                  {
                    type: 'divider'
                  },
                  {
                    type: 'group',
                    label: '在线玩家',
                    children: users.length <= 1 
                      ? [{ key: 'empty', label: '暂无其他玩家', disabled: true }]
                      : users.filter(u => u !== user?.username).map(u => ({
                          key: `pm_${u}`,
                          icon: <UserOutlined />,
                          label: u
                        }))
                  }
                ]}
              />
            </Sider>
            
            <Layout style={{ background: '#fff', height: '100%' }}>
              {!activeTab ? (
                <div style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <Empty description="请在左侧选择大厅或玩家进行聊天" />
                </div>
              ) : (
                <Content style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div style={{ padding: '16px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
                    <Title level={5} style={{ margin: 0 }}>
                      {activeTab === 'lobby' ? '大厅广播' : `与 ${activeTab.replace('pm_', '')} 私聊`}
                    </Title>
                  </div>
                  
                  <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                    {filteredMessages.length === 0 ? (
                        <div style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            <Empty description="暂无消息" />
                        </div>
                    ) : (
                        <List
                        dataSource={filteredMessages}
                        renderItem={(item) => (
                            <List.Item style={{ borderBottom: 'none', padding: '8px 0', display: 'block' }}>
                            {item.type === 'join' || item.type === 'leave' ? (
                                <div style={{ textAlign: 'center', width: '100%' }}>
                                <Text type="secondary" style={{ fontSize: '12px', background: '#f5f5f5', padding: '2px 8px', borderRadius: '10px' }}>
                                    {item.content}
                                </Text>
                                </div>
                            ) : (
                                <div style={{ 
                                    display: 'flex', 
                                    flexDirection: item.sender === user?.username ? 'row-reverse' : 'row',
                                    alignItems: 'flex-start'
                                }}>
                                    <Avatar icon={<UserOutlined />} style={{ margin: item.sender === user?.username ? '0 0 0 8px' : '0 8px 0 0', backgroundColor: item.sender === user?.username ? '#1890ff' : undefined }} />
                                    <div>
                                        <div style={{ 
                                            textAlign: item.sender === user?.username ? 'right' : 'left',
                                            marginBottom: '4px'
                                        }}>
                                            <Text type="secondary" style={{ fontSize: '12px' }}>
                                                {item.sender}
                                            </Text>
                                        </div>
                                        <div style={{ 
                                        background: item.sender === user?.username ? '#e6f7ff' : '#f0f2f5', 
                                        padding: '8px 12px', 
                                        borderRadius: '8px', 
                                        display: 'inline-block',
                                        maxWidth: '100%',
                                        wordBreak: 'break-word',
                                        textAlign: 'left'
                                        }}>
                                        <Text>{item.content}</Text>
                                        </div>
                                    </div>
                                </div>
                            )}
                            </List.Item>
                        )}
                        />
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  <div style={{ padding: '16px', borderTop: '1px solid #f0f0f0' }}>
                    <Input
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onPressEnter={handleSend}
                      placeholder="输入消息..."
                      size="large"
                      suffix={<Button type="text" icon={<SendOutlined style={{ color: '#1890ff' }}/>} onClick={handleSend} />}
                    />
                  </div>
                </Content>
              )}
            </Layout>
          </>
        )}
      </Layout>
    </div>
  );
};

export default Chat;
