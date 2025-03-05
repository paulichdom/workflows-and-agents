"use client"
import {
  Attachments,
  Bubble,
  Conversations,
  Prompts,
  Sender,
  Welcome,
  useXAgent,
  useXChat,
} from '@ant-design/x';
import { Layout, Button, Space, Badge, type GetProp, Card, ConfigProvider, theme } from 'antd';
import {
  CloudUploadOutlined,
  CommentOutlined,
  EllipsisOutlined,
  FireOutlined,
  HeartOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PaperClipOutlined,
  PlusOutlined,
  ReadOutlined,
  ShareAltOutlined,
  SmileOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import React, { useEffect } from 'react';
import styled from 'styled-components';

const { Header, Content, Sider } = Layout;

// Reusable Components
const Logo = ({ className }: { className: string }) => (
  <div className={className}>
    <img
      src="https://mdn.alipayobjects.com/huamei_iwk9zp/afts/img/A*eco6RrQhxbMAAAAAAAAAAAAADgCCAQ/original"
      draggable={false}
      alt="logo"
    />
    <span>Ant Design X</span>
  </div>
);

const TitleWithIcon = ({ icon, title }: { icon: React.ReactElement; title: string }) => (
  <Space align="start">
    {icon}
    <span>{title}</span>
  </Space>
);

// Constants
const CHAT_ROLES: GetProp<typeof Bubble.List, 'roles'> = {
  ai: {
    placement: 'start',
    typing: { step: 5, interval: 20 },
    styles: { content: { borderRadius: 16 } },
  },
  local: {
    placement: 'end',
    variant: 'shadow',
  },
};

const DEFAULT_CONVERSATIONS = [
  {
    key: '0',
    label: 'What is Ant Design X?',
  },
];

const PROMPT_ITEMS = [
  {
    key: '1',
    label: <TitleWithIcon icon={<FireOutlined style={{ color: '#FF4D4F' }} />} title="Hot Topics" />,
    description: 'What are you interested in?',
    children: [
      { key: '1-1', description: `What's new in X?` },
      { key: '1-2', description: `What's AGI?` },
      { key: '1-3', description: `Where is the doc?` },
    ],
  },
  {
    key: '2',
    label: <TitleWithIcon icon={<ReadOutlined style={{ color: '#1890FF' }} />} title="Design Guide" />,
    description: 'How to design a good product?',
    children: [
      { key: '2-1', icon: <HeartOutlined />, description: `Know the well` },
      { key: '2-2', icon: <SmileOutlined />, description: `Set the AI role` },
      { key: '2-3', icon: <CommentOutlined />, description: `Express the feeling` },
    ],
  },
  {
    key: '3',
    label: <TitleWithIcon icon={<RocketOutlined style={{ color: '#722ED1' }} />} title="Start Creating" />,
    description: 'How to start a new project?',
    children: [
      { key: '3-1', label: 'Fast Start', description: `Install Ant Design X` },
      { key: '3-2', label: 'Online Playground', description: `Play on the web without installing` },
    ],
  },
];

const SENDER_PROMPTS = [
  {
    key: '1',
    description: 'Hot Topics',
    icon: <FireOutlined style={{ color: '#FF4D4F' }} />,
  },
  {
    key: '2',
    description: 'Design Guide',
    icon: <ReadOutlined style={{ color: '#1890FF' }} />,
  },
];

// Main Component
const ChatInterface: React.FC = () => {
  const [collapsed, setCollapsed] = React.useState(false);
  const [headerOpen, setHeaderOpen] = React.useState(false);
  const [content, setContent] = React.useState('');
  const [conversationsItems, setConversationsItems] = React.useState(DEFAULT_CONVERSATIONS);
  const [activeKey, setActiveKey] = React.useState(DEFAULT_CONVERSATIONS[0]?.key);
  const [attachedFiles, setAttachedFiles] = React.useState<GetProp<typeof Attachments, 'items'>>([]);

  const [agent] = useXAgent({
    request: async ({ message }, { onSuccess }) => {
      onSuccess(`Mock success return. You said: ${message}`);
    },
  });

  const { onRequest, messages, setMessages } = useXChat({ agent });

  useEffect(() => {
    if (activeKey !== undefined) {
      setMessages([]);
    }
  }, [activeKey]);

  const handleSubmit = (nextContent: string) => {
    if (!nextContent) return;
    onRequest(nextContent);
    setContent('');
  };

  const handlePromptsItemClick: GetProp<typeof Prompts, 'onItemClick'> = (info) => {
    onRequest(info.data.description as string);
  };

  const handleAddConversation = () => {
    const newConversation = {
      key: `${conversationsItems.length}`,
      label: `New Conversation ${conversationsItems.length}`,
    };
    setConversationsItems([...conversationsItems, newConversation]);
    setActiveKey(newConversation.key);
  };

  const handleFileChange: GetProp<typeof Attachments, 'onChange'> = (info) =>
    setAttachedFiles(info.fileList);

  const items: GetProp<typeof Bubble.List, 'items'> = messages.map(({ id, message, status }) => ({
    key: id,
    loading: status === 'loading',
    role: status === 'local' ? 'local' : 'ai',
    content: message,
  }));

  const welcomeSection = (
    <ConfigProvider
      theme={{
        algorithm: [theme.defaultAlgorithm],
        components: {
          Card: {
            borderRadius: 0,
          },
        },
      }}
    >
      <Space direction="vertical" size={16} className="placeholder" style={{ width: '100%' }}>
        <Welcome
          variant="borderless"
          icon="https://mdn.alipayobjects.com/huamei_iwk9zp/afts/img/A*s5sNRo5LjfQAAAAAAAAAAAAADgCCAQ/fmt.webp"
          title="Hello, I'm Ant Design X"
          description="Base on Ant Design, AGI product interface solution, create a better intelligent vision~"
          extra={
            <Space>
              <Button icon={<ShareAltOutlined />} />
              <Button icon={<EllipsisOutlined />} />
            </Space>
          }
        />
        <Card style={{ border: 0, width: '100%' }}>
          <Prompts
            title="Do you want?"
            items={PROMPT_ITEMS}
            wrap
            styles={{
              list: { 
                width: '100%', 
                display: 'flex', 
                justifyContent: 'center', 
                gap: '12px',
                flexWrap: 'wrap'
              },
              item: {
                flex: 'none',
                width: '30%',
                minWidth: '250px',
                backgroundImage: 'linear-gradient(137deg, #e5f4ff 0%, #efe7ff 100%)',
                border: 0,
              },
              subItem: {
                background: 'rgba(255,255,255,0.45)',
                border: '1px solid #FFF',
              },
            }}
            onItemClick={handlePromptsItemClick}
          />
        </Card>
      </Space>
    </ConfigProvider>
  );

  return (
    <MainLayout>
      <StyledSider 
        width={280} 
        collapsible 
        collapsed={collapsed}
        onCollapse={setCollapsed}
        trigger={null}
      >
        <Logo className="logo" />
        <Button
          onClick={handleAddConversation}
          type="link"
          icon={<PlusOutlined />}
          style={{ margin: '0 12px 24px', width: 'calc(100% - 24px)' }}
        >
          {!collapsed && "New Conversation"}
        </Button>
        <Conversations
          items={conversationsItems}
          activeKey={activeKey}
          onActiveChange={setActiveKey}
          style={{ padding: '0 12px', flex: 1, overflowY: 'auto' }}
        />
      </StyledSider>
      <Layout>
        <Header style={{ padding: '0 16px', background: '#fff', borderBottom: '1px solid #f0f0f0' }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: '16px', width: 64, height: 64 }}
          />
        </Header>
        <MainContent>
          <ChatContainer>
            <MessagesContainer>
              <Bubble.List
                items={items.length > 0 ? items : [{ content: welcomeSection, variant: 'borderless' }]}
                roles={CHAT_ROLES}
              />
            </MessagesContainer>
            <InputContainer>
              <Prompts 
                items={SENDER_PROMPTS} 
                onItemClick={handlePromptsItemClick}
                styles={{
                  list: { 
                    width: '100%', 
                    display: 'flex', 
                    justifyContent: 'center', 
                    gap: '12px' 
                  },
                  item: {
                    flex: 'none',
                    minWidth: '120px',
                    backgroundImage: 'linear-gradient(137deg, #e5f4ff 0%, #efe7ff 100%)',
                    border: 0,
                  },
                }}
              />
              <Sender
                value={content}
                header={
                  <Sender.Header
                    title="Attachments"
                    open={headerOpen}
                    onOpenChange={setHeaderOpen}
                    styles={{ content: { padding: 0 } }}
                  >
                    <Attachments
                      beforeUpload={() => false}
                      items={attachedFiles}
                      onChange={handleFileChange}
                      placeholder={(type) =>
                        type === 'drop'
                          ? { title: 'Drop file here' }
                          : {
                              icon: <CloudUploadOutlined />,
                              title: 'Upload files',
                              description: 'Click or drag files to this area to upload',
                            }
                      }
                    />
                  </Sender.Header>
                }
                onSubmit={handleSubmit}
                onChange={setContent}
                prefix={
                  <Badge dot={attachedFiles.length > 0 && !headerOpen}>
                    <Button 
                      type="text" 
                      icon={<PaperClipOutlined />} 
                      onClick={() => setHeaderOpen(!headerOpen)} 
                    />
                  </Badge>
                }
                loading={agent.isRequesting()}
                style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
              />
            </InputContainer>
          </ChatContainer>
        </MainContent>
      </Layout>
    </MainLayout>
  );
};

export default ChatInterface;

// Styled Components
const MainLayout = styled(Layout)`
  min-height: 100vh;
`;

const MainContent = styled(Content)`
  display: grid;
  grid-template-columns: 1fr min(1100px) 1fr;
  grid-template-rows: 1fr auto;
  grid-column-gap: 32px;
  position: relative;
  padding: 24px;
  
  & > * {
    grid-column: 2;
  }
`;

const ChatContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: calc(100vh - 120px);
  overflow: hidden;
`;

const MessagesContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding-bottom: 16px;
  
  .placeholder {
    display: flex;
    justify-content: center;
    align-items: center;
    padding-top: 32px;
  }
`;

const InputContainer = styled.div`
  position: sticky;
  bottom: 0;
  background: white;
  padding: 16px 0;
  border-top: 1px solid #f0f0f0;
  z-index: 1;

  .ant-x-prompts {
    margin-bottom: 16px;
  }

  .ant-x-prompts-list {
    display: flex;
    justify-content: center;
    gap: 12px;
  }
`;

const StyledSider = styled(Sider)`
  &.ant-layout-sider {
    background: rgba(0,0,0,0.02);
    border-right: 1px solid #f0f0f0;
  }
`;