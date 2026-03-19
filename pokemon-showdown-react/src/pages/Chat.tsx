import React, { useEffect, useState, useRef } from 'react';
import { Layout, Menu, Input, List, Avatar, Typography, Button, Empty, message, Select, Card, Spin, Tabs } from 'antd';
import { UserOutlined, MessageOutlined, TeamOutlined, SendOutlined, PlayCircleOutlined, BuildOutlined } from '@ant-design/icons';
import { authService } from '../services/auth';
import TeamBuilder from '../components/TeamBuilder';
import { BattleArena } from '../components/BattleArena';

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

// Battle/Matchmaking interfaces
interface GatewayMessage {
  type: string;
  payload: any;
}

const Chat: React.FC = () => {
  const user = authService.getCurrentUser();
  // Chat WebSocket
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

  // Gateway (Matchmaking & Battle) WebSocket
  const [gatewayWs, setGatewayWs] = useState<WebSocket | null>(null);
  const [battleFormat, setBattleFormat] = useState('gen9randombattle');
  const [isSearching, setIsSearching] = useState(false);
  const [searchTime, setSearchTime] = useState(0);
  const [activeBattle, setActiveBattle] = useState<string | null>(null);
  const [battleLogs, setBattleLogs] = useState<string[]>([]);
  const [battleInput, setBattleInput] = useState('');
  const gatewayWsRef = useRef<WebSocket | null>(null);
  const battleLogsEndRef = useRef<HTMLDivElement>(null);

  // Chat WebSocket Effect
  useEffect(() => {
    const currentUsername = user?.username;
    
    if (!currentUsername) return;

    if (wsRef.current) return;

    const socket = new WebSocket(`ws://localhost:8082/ws?username=${currentUsername}`);
    wsRef.current = socket;
    wsOpenedRef.current = false;

    socket.onopen = () => {
      console.log('Connected to chat server');
      wsOpenedRef.current = true;
    };

    socket.onmessage = (event) => {
      try {
        const rawData = event.data;
        const msgs = rawData.split('\n').filter((msg: string) => msg.trim() !== '');
        
        for (const rawMsg of msgs) {
          const msg: ChatMessage = JSON.parse(rawMsg);
          if (msg.type === 'users_update') {
            const userList = JSON.parse(msg.content);
            setUsers(userList);
          } else if (msg.type === 'kick') {
            authService.logout();
            window.location.href = '/login?kick=true';
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
      if (!wsOpenedRef.current) return;
      if (e.code === 1000 || e.code === 1001) return;

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

  // Gateway WebSocket Effect (Matchmaking & Battle)
  useEffect(() => {
    const currentUsername = user?.username;
    if (!currentUsername) return;
    if (gatewayWsRef.current) return;

    const socket = new WebSocket(`ws://localhost:8083/ws/gateway?username=${currentUsername}`);
    gatewayWsRef.current = socket;

    socket.onopen = () => {
      console.log('Connected to gateway server');
    };

    socket.onmessage = (event) => {
      // Parse battle logs or match found events
      // Since our simple backend just logs for now, we simulate receiving logs
      // If backend sends proper JSON we would parse it here.
      // For this demo, let's just append raw text if it's not JSON
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'match_found') {
           setActiveBattle(data.payload.matchId);
           setIsSearching(false);
           setSearchTime(0);
           message.success('匹配成功！对战即将开始');
        } else if (data.type === 'battle_log') {
           setBattleLogs(prev => [...prev, ...data.payload.logs]);
        }
      } catch {
        // Fallback for raw string logs from backend if any
        setBattleLogs(prev => [...prev, event.data]);
      }
    };

    setGatewayWs(socket);

    return () => {
      if (gatewayWsRef.current) {
        gatewayWsRef.current.close(1000, "Component unmounting");
        gatewayWsRef.current = null;
      }
    };
  }, [user?.username]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeTab]);

  useEffect(() => {
    battleLogsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [battleLogs]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isSearching) {
      timer = setInterval(() => {
        setSearchTime(prev => prev + 1);
      }, 1000);
    } else {
      setSearchTime(0);
    }
    return () => clearInterval(timer);
  }, [isSearching]);

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

  const handleSearchMatch = () => {
    if (!gatewayWs) {
      message.error("网关连接未建立，请稍后再试");
      return;
    }
    setIsSearching(true);
    setSearchTime(0);
    const req: GatewayMessage = {
      type: 'join_queue',
      payload: { format: battleFormat }
    };
    gatewayWs.send(JSON.stringify(req));
  };

  const handleCancelMatch = () => {
    if (!gatewayWs) return;
    setIsSearching(false);
    setSearchTime(0);
    const req: GatewayMessage = {
      type: 'leave_queue',
      payload: { format: battleFormat }
    };
    gatewayWs.send(JSON.stringify(req));
    message.info('已取消匹配');
  };

  const handleBattleActionFromUI = (action: string) => {
    if (!gatewayWs || !activeBattle) return;
    const req: GatewayMessage = {
      type: 'battle_action',
      payload: { 
        matchId: activeBattle,
        player: 'p1', // TODO: Determine actual player side
        action: action 
      }
    };
    gatewayWs.send(JSON.stringify(req));
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
      <div style={{ flex: 1, background: '#f5f5f5', borderRadius: '8px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Tabs defaultActiveKey="battle" style={{ height: '100%' }} tabBarStyle={{ padding: '0 16px', background: '#fff', margin: 0 }}>
          <Tabs.TabPane tab={<span><PlayCircleOutlined /> 战斗大厅</span>} key="battle" style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {!activeBattle ? (
                <Card style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
                  <Title level={5}>寻找对战</Title>
                  <div style={{ margin: '20px 0' }}>
                    <Select
                      value={battleFormat}
                      onChange={setBattleFormat}
                      style={{ width: '100%', marginBottom: 16 }}
                      options={[
                        { value: 'gen9randombattle', label: '[Gen 9] 随机对战' },
                        { value: 'gen9ou', label: '[Gen 9] OU' },
                      ]}
                    />
                    <Button 
                      type="primary" 
                      size="large" 
                      block 
                      icon={isSearching ? <Spin /> : <PlayCircleOutlined />}
                      onClick={handleSearchMatch}
                      disabled={isSearching}
                    >
                      {isSearching ? `正在寻找对手... ${searchTime}s` : '开始匹配'}
                    </Button>
                    {isSearching && searchTime > 5 && (
                      <Button 
                        danger 
                        size="large" 
                        block 
                        style={{ marginTop: '12px' }}
                        onClick={handleCancelMatch}
                      >
                        取消匹配
                      </Button>
                    )}
                  </div>
                </Card>
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ flex: 2, minHeight: 300 }}>
                    <BattleArena logs={battleLogs} onAction={handleBattleActionFromUI} isActive={true} />
                  </div>
                  <Card title="战斗日志" style={{ flex: 1, display: 'flex', flexDirection: 'column', marginTop: 16 }} bodyStyle={{ flex: 1, overflowY: 'auto', padding: '12px', background: '#000', color: '#0f0', fontFamily: 'monospace' }}>
                    {battleLogs.map((log, i) => (
                      <div key={i}>{log}</div>
                    ))}
                    <div ref={battleLogsEndRef} />
                  </Card>
                </div>
              )}
            </div>
          </Tabs.TabPane>
          <Tabs.TabPane tab={<span><BuildOutlined /> 队伍编辑</span>} key="teambuilder" style={{ height: '100%', overflow: 'hidden' }}>
             <TeamBuilder />
          </Tabs.TabPane>
        </Tabs>
      </div>

      {/* Chat Section (Right half) */}
      <Layout 
        style={{ 
          width: chatVisible ? '50%' : '200px',
          flex: chatVisible ? 'none' : '0 0 200px',
          minWidth: chatVisible ? '300px' : '200px',
          transition: 'all 0.3s',
          height: '100%', 
          background: '#fff', 
          borderRadius: '8px', 
          overflow: 'hidden', 
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          position: 'relative'
        }}
      >
        <Sider width={200} theme="light" style={{ borderRight: chatVisible ? '1px solid #f0f0f0' : 'none', height: '100%' }} breakpoint="lg" collapsedWidth="0">
          <div style={{ padding: '16px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={5} style={{ margin: 0 }}><MessageOutlined /> 聊天室</Title>
            <Button type="text" size="small" onClick={() => setChatVisible(!chatVisible)}>
              {chatVisible ? '收起' : '展开'}
            </Button>
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
        
        {chatVisible && (
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
        )}
      </Layout>
    </div>
  );
};

export default Chat;
