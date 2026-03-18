import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, message } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../services/auth';

const { Title, Text } = Typography;

const Register: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      await authService.register(values.username, values.password, values.email);
      message.success('注册成功！请登录。');
      navigate('/login');
    } catch (error: any) {
      if (error.response && error.response.data && error.response.data.error) {
        message.error(error.response.data.error);
      } else {
        message.error('注册失败，请重试。');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card style={{ width: 400, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Title level={3}>加入 Pokemon Battle</Title>
        <Text type="secondary">创建你的账号</Text>
      </div>

      <Form
        name="register"
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
          name="email"
          rules={[
            { type: 'email', message: '邮箱格式不正确！' },
          ]}
        >
          <Input prefix={<MailOutlined />} placeholder="邮箱（选填）" />
        </Form.Item>

        <Form.Item
          name="password"
          rules={[{ required: true, message: '请输入您的密码！' }, { min: 6, message: '密码至少需要6个字符' }]}
        >
          <Input.Password prefix={<LockOutlined />} placeholder="密码" />
        </Form.Item>

        <Form.Item
          name="confirm"
          dependencies={['password']}
          hasFeedback
          rules={[
            { required: true, message: '请确认您的密码！' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('password') === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error('两次输入的密码不一致！'));
              },
            }),
          ]}
        >
          <Input.Password prefix={<LockOutlined />} placeholder="确认密码" />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            注册
          </Button>
        </Form.Item>
        
        <div style={{ textAlign: 'center' }}>
          已有账号？ <Link to="/login">去登录</Link>
        </div>
      </Form>
    </Card>
  );
};

export default Register;
