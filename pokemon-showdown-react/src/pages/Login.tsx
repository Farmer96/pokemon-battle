import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../services/auth';

const { Title, Text } = Typography;

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      await authService.login(values.username, values.password);
      message.success('登录成功！');
      // Navigate to dashboard or home
      navigate('/');
    } catch (error: any) {
      if (error.response && error.response.data && error.response.data.error) {
        message.error(error.response.data.error);
      } else {
        message.error('登录失败，请检查您的用户名或密码。');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card style={{ width: 400, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Title level={3}>欢迎回来！</Title>
        <Text type="secondary">登录到 Pokemon Battle</Text>
      </div>

      <Form
        name="login"
        initialValues={{ remember: true }}
        onFinish={onFinish}
        layout="vertical"
        size="large"
      >
        <Form.Item
          name="username"
          rules={[{ required: true, message: '请输入您的用户名！' }]}
        >
          <Input prefix={<UserOutlined />} placeholder="用户名" />
        </Form.Item>

        <Form.Item
          name="password"
          rules={[{ required: true, message: '请输入您的密码！' }]}
        >
          <Input.Password prefix={<LockOutlined />} placeholder="密码" />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            登录
          </Button>
        </Form.Item>
        
        <div style={{ textAlign: 'center' }}>
          还没有账号？ <Link to="/register">立即注册</Link>
        </div>
      </Form>
    </Card>
  );
};

export default Login;
