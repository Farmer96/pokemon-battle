import React, { useState, useEffect, useMemo } from 'react';
import { Card, Typography, Button, Input, List, Modal, Select, message, Popconfirm, Form, Row, Col, Space, Avatar, AutoComplete } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { teamService, UserTeam } from '../services/team';

const { Title, Text } = Typography;
const { TextArea } = Input;

// Helper to parse Showdown export format loosely for graphical display
interface ParsedPokemon {
  species: string;
  item: string;
  ability: string;
  moves: string[];
}

const parseExportTeam = (text: string): ParsedPokemon[] => {
  if (!text) return [];
  const team: ParsedPokemon[] = [];
  const blocks = text.trim().split(/\n\s*\n/);
  
  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length === 0 || !lines[0].trim()) continue;
    
    const poke: ParsedPokemon = { species: '', item: '', ability: '', moves: [] };
    
    // First line: Species @ Item
    const firstLine = lines[0].trim();
    const itemSplit = firstLine.split('@');
    poke.item = itemSplit.length > 1 ? itemSplit[1].trim() : '';
    
    // Extract species (handling Nickname (Species) format)
    let speciesPart = itemSplit[0].trim();
    if (speciesPart.endsWith(')')) {
      const match = speciesPart.match(/\(([^)]+)\)$/);
      if (match) speciesPart = match[1];
    }
    // Remove gender (M) or (F)
    speciesPart = speciesPart.replace(/ \([MF]\)$/, '');
    poke.species = speciesPart;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('Ability:')) {
        poke.ability = line.substring(8).trim();
      } else if (line.startsWith('-')) {
        poke.moves.push(line.substring(1).trim());
      }
    }
    team.push(poke);
  }
  return team;
};

// Helper to generate export text from ParsedPokemon
const generateExportTeam = (team: ParsedPokemon[]): string => {
  return team.map(p => {
    let out = p.species;
    if (p.item) out += ` @ ${p.item}`;
    out += '\n';
    if (p.ability) out += `Ability: ${p.ability}\n`;
    // For simplicity, EVs and Nature are omitted in this basic GUI generator unless added to state
    out += `EVs: 252 HP / 252 Atk / 4 SpD\nAdamant Nature\n`;
    p.moves.forEach(m => {
      if (m) out += `- ${m}\n`;
    });
    return out;
  }).join('\n\n');
};

const TeamBuilder: React.FC = () => {
  const [teams, setTeams] = useState<UserTeam[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Partial<UserTeam>>({});
  const [loading, setLoading] = useState(false);
  const [parsedTeam, setParsedTeam] = useState<ParsedPokemon[]>([]);
  const [mode, setMode] = useState<'gui' | 'text'>('gui');

  // Compute options for AutoComplete from global window objects
  const pokemonOptions = useMemo(() => {
    if (!window.BattlePokedex) return [];
    return Object.values(window.BattlePokedex)
      .filter((p: any) => p.num > 0)
      .map((p: any) => ({ value: p.name, label: p.name }));
  }, []);

  const itemOptions = useMemo(() => {
    if (!window.BattleItems) return [];
    return Object.values(window.BattleItems)
      .map((i: any) => ({ value: i.name, label: i.name }));
  }, []);

  const abilityOptions = useMemo(() => {
    if (!window.BattleAbilities) return [];
    return Object.values(window.BattleAbilities)
      .map((a: any) => ({ value: a.name, label: a.name }));
  }, []);

  const moveOptions = useMemo(() => {
    if (!window.BattleMovedex) return [];
    return Object.values(window.BattleMovedex)
      .map((m: any) => ({ value: m.name, label: m.name }));
  }, []);

  useEffect(() => {
    fetchTeams();
  }, []);

  // Update Parsed Team when Text changes
  useEffect(() => {
    if (mode === 'text' && editingTeam.team_data) {
      setParsedTeam(parseExportTeam(editingTeam.team_data));
    }
  }, [editingTeam.team_data, mode]);

  // Update Text when GUI changes
  useEffect(() => {
    if (mode === 'gui' && parsedTeam.length > 0) {
      setEditingTeam(prev => ({...prev, team_data: generateExportTeam(parsedTeam)}));
    }
  }, [parsedTeam, mode]);

  const fetchTeams = async () => {
    try {
      const data = await teamService.getTeams();
      setTeams(data);
    } catch (err) {
      message.error('无法获取队伍列表');
    }
  };

  const handleSave = async () => {
    if (!editingTeam.name || !editingTeam.team_data) {
      message.error('队伍名称和内容不能为空');
      return;
    }
    setLoading(true);
    try {
      await teamService.saveTeam(
        editingTeam.name,
        editingTeam.format || 'gen9ou',
        editingTeam.team_data
      );
      message.success('队伍保存成功！');
      setIsModalVisible(false);
      setEditingTeam({});
      fetchTeams();
    } catch (err) {
      message.error('队伍保存失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await teamService.deleteTeam(id);
      message.success('队伍已删除');
      fetchTeams();
    } catch (err) {
      message.error('队伍删除失败');
    }
  };

  const openEditor = (team?: UserTeam) => {
    if (team) {
      setEditingTeam(team);
      setParsedTeam(parseExportTeam(team.team_data));
    } else {
      setEditingTeam({ format: 'gen9ou', team_data: '' });
      setParsedTeam([]);
    }
    setMode('gui');
    setIsModalVisible(true);
  };

  const addPokemon = () => {
    if (parsedTeam.length >= 6) return;
    setParsedTeam([...parsedTeam, { species: '', item: '', ability: '', moves: ['', '', '', ''] }]);
  };

  const updatePokemon = (index: number, field: keyof ParsedPokemon, value: any) => {
    const newTeam = [...parsedTeam];
    newTeam[index] = { ...newTeam[index], [field]: value };
    setParsedTeam(newTeam);
  };

  const updateMove = (pokeIndex: number, moveIndex: number, value: string) => {
    const newTeam = [...parsedTeam];
    const newMoves = [...(newTeam[pokeIndex].moves || [])];
    newMoves[moveIndex] = value;
    newTeam[pokeIndex] = { ...newTeam[pokeIndex], moves: newMoves };
    setParsedTeam(newTeam);
  };

  const removePokemon = (index: number) => {
    const newTeam = [...parsedTeam];
    newTeam.splice(index, 1);
    setParsedTeam(newTeam);
  };

  const getSpriteUrl = (pokemonName: string) => {
    if (!pokemonName) return '';
    const safeName = pokemonName.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `https://play.pokemonshowdown.com/sprites/dex/${safeName}.png`;
  };

  const getItemUrl = (itemName: string) => {
    if (!itemName) return '';
    const safeName = itemName.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `https://play.pokemonshowdown.com/sprites/itemicons/${safeName}.png`;
  };

  return (
    <Card 
      title={<Title level={5} style={{ margin: 0 }}>队伍编辑器 (Team Builder)</Title>} 
      extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>新建队伍</Button>}
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      bodyStyle={{ flex: 1, overflowY: 'auto' }}
    >
      <List
        dataSource={teams}
        locale={{ emptyText: '暂无保存的队伍，快去创建一个吧！' }}
        renderItem={team => (
          <List.Item
            actions={[
              <Button type="text" icon={<EditOutlined />} onClick={() => openEditor(team)}>编辑</Button>,
              <Popconfirm
                title="确定要删除这个队伍吗？"
                onConfirm={() => handleDelete(team.id)}
                okText="确定"
                cancelText="取消"
              >
                <Button type="text" danger icon={<DeleteOutlined />}>删除</Button>
              </Popconfirm>
            ]}
          >
            <List.Item.Meta
              title={team.name}
              description={`格式: ${team.format}`}
            />
          </List.Item>
        )}
      />

      <Modal
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 24 }}>
            <span>{editingTeam.id ? "编辑队伍" : "新建队伍"}</span>
            <Select value={mode} onChange={setMode} style={{ width: 120 }} size="small">
              <Select.Option value="gui">图形界面</Select.Option>
              <Select.Option value="text">文本导入/导出</Select.Option>
            </Select>
          </div>
        }
        open={isModalVisible}
        onOk={handleSave}
        onCancel={() => setIsModalVisible(false)}
        confirmLoading={loading}
        width={800}
        okText="保存"
        cancelText="取消"
      >
        <Input 
          placeholder="队伍名称" 
          value={editingTeam.name} 
          onChange={e => setEditingTeam({...editingTeam, name: e.target.value})}
          style={{ marginBottom: 16 }}
        />
        <Select
          value={editingTeam.format}
          onChange={val => setEditingTeam({...editingTeam, format: val})}
          style={{ width: '100%', marginBottom: 16 }}
          options={[
            { value: 'gen9ou', label: '[Gen 9] OU' },
            { value: 'gen9vgc2023', label: '[Gen 9] VGC 2023' },
            { value: 'gen9nationaldex', label: '[Gen 9] National Dex' },
          ]}
        />

        {mode === 'text' ? (
          <>
            <Text type="secondary">请粘贴 Showdown 导出格式 (Export Format) 的队伍代码：</Text>
            <TextArea 
              rows={12} 
              value={editingTeam.team_data}
              onChange={e => setEditingTeam({...editingTeam, team_data: e.target.value})}
              placeholder={`Pikachu @ Light Ball\nAbility: Static\nEVs: 252 SpA / 4 SpD / 252 Spe\nTimid Nature\n- Thunderbolt\n- Surf\n- Substitute\n- Nasty Plot`}
              style={{ marginTop: 8, fontFamily: 'monospace' }}
            />
          </>
        ) : (
          <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
              {parsedTeam.map((poke, index) => (
                <Card 
                  key={index} 
                  size="small" 
                  title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {poke.species ? (
                        <img src={getSpriteUrl(poke.species)} alt={poke.species} style={{ height: 30, imageRendering: 'pixelated' }} onError={(e) => (e.currentTarget.style.display = 'none')} />
                      ) : (
                        <Avatar size={30} icon={<PlusOutlined />} />
                      )}
                      <span>#{index + 1} {poke.species || '空位'}</span>
                    </div>
                  } 
                  extra={<Button type="text" danger icon={<DeleteOutlined />} onClick={() => removePokemon(index)} />}
                  style={{ width: 'calc(50% - 8px)' }}
                >
                  <Form layout="vertical" size="small">
                    <Row gutter={8}>
                      <Col span={12}>
                        <Form.Item label="宝可梦">
                          <AutoComplete
                            options={pokemonOptions}
                            filterOption={(inputValue, option) =>
                              option!.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                            }
                            value={poke.species} 
                            onChange={val => updatePokemon(index, 'species', val)} 
                            placeholder="如: Pikachu" 
                          />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item label="道具">
                          <AutoComplete
                            options={itemOptions}
                            filterOption={(inputValue, option) =>
                              option!.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                            }
                            value={poke.item} 
                            onChange={val => updatePokemon(index, 'item', val)} 
                            placeholder="如: Leftovers" 
                          >
                            <Input prefix={poke.item ? <img src={getItemUrl(poke.item)} alt="item" style={{ height: 16 }} onError={(e) => (e.currentTarget.style.display = 'none')} /> : null} />
                          </AutoComplete>
                        </Form.Item>
                      </Col>
                    </Row>
                    <Form.Item label="特性" style={{ marginBottom: 8 }}>
                      <AutoComplete
                        options={abilityOptions}
                        filterOption={(inputValue, option) =>
                          option!.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                        }
                        value={poke.ability} 
                        onChange={val => updatePokemon(index, 'ability', val)} 
                        placeholder="如: Overgrow" 
                      />
                    </Form.Item>
                    <Row gutter={8}>
                      {[0, 1, 2, 3].map(mIndex => (
                        <Col span={12} key={mIndex}>
                          <Form.Item style={{ marginBottom: 8 }}>
                            <AutoComplete
                              options={moveOptions}
                              filterOption={(inputValue, option) =>
                                option!.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                              }
                              value={poke.moves[mIndex] || ''} 
                              onChange={val => updateMove(index, mIndex, val)} 
                              placeholder={`技能 ${mIndex + 1}`} 
                            />
                          </Form.Item>
                        </Col>
                      ))}
                    </Row>
                  </Form>
                </Card>
              ))}
            </div>
            {parsedTeam.length < 6 && (
              <Button type="dashed" block icon={<PlusOutlined />} onClick={addPokemon}>
                添加宝可梦 ({parsedTeam.length}/6)
              </Button>
            )}
          </div>
        )}
      </Modal>
    </Card>
  );
};

export default TeamBuilder;