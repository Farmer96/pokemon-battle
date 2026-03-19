import React, { useState, useEffect } from 'react';
import { Card, Typography, Button, Tooltip, Progress, Space } from 'antd';
import './BattleArena.css'; // We will create this

const { Title, Text } = Typography;

interface BattleArenaProps {
  logs: string[];
  onAction: (action: string) => void;
  isActive: boolean;
}

// Very basic state representation derived from logs (Proof of Concept)
export const BattleArena: React.FC<BattleArenaProps> = ({ logs, onAction, isActive }) => {
  const [p1Active, setP1Active] = useState<string>('Pikachu');
  const [p2Active, setP2Active] = useState<string>('Charmander');
  const [p1Hp, setP1Hp] = useState<number>(100);
  const [p2Hp, setP2Hp] = useState<number>(100);

  // Parse basic logs to update state (Simplified)
  useEffect(() => {
    for (const log of logs) {
      if (log.includes('|switch|p1a:')) {
        const parts = log.split('|');
        setP1Active(parts[3].split(',')[0]);
      } else if (log.includes('|switch|p2a:')) {
        const parts = log.split('|');
        setP2Active(parts[3].split(',')[0]);
      } else if (log.includes('|-damage|p1a:')) {
        setP1Hp(prev => Math.max(0, prev - 20)); // Dummy damage
      } else if (log.includes('|-damage|p2a:')) {
        setP2Hp(prev => Math.max(0, prev - 20)); // Dummy damage
      }
    }
  }, [logs]);

  const getSpriteUrl = (pokemonName: string, isBack: boolean = false) => {
    const safeName = pokemonName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const dir = isBack ? 'ani-back' : 'ani';
    return `https://play.pokemonshowdown.com/sprites/${dir}/${safeName}.gif`;
  };

  return (
    <div className="battle-arena">
      <div className="battle-field">
        {/* Opponent Side */}
        <div className="pokemon-container opponent">
          <div className="statbar opponent-statbar">
            <strong>{p2Active}</strong>
            <Progress percent={p2Hp} showInfo={false} strokeColor={p2Hp > 50 ? '#52c41a' : p2Hp > 20 ? '#faad14' : '#ff4d4f'} />
          </div>
          <div className="sprite-wrapper">
            <img src={getSpriteUrl(p2Active, false)} alt={p2Active} className="pokemon-sprite" />
          </div>
        </div>

        {/* Player Side */}
        <div className="pokemon-container player">
          <div className="sprite-wrapper">
            <img src={getSpriteUrl(p1Active, true)} alt={p1Active} className="pokemon-sprite back-sprite" />
          </div>
          <div className="statbar player-statbar">
            <strong>{p1Active}</strong>
            <Progress percent={p1Hp} showInfo={false} strokeColor={p1Hp > 50 ? '#52c41a' : p1Hp > 20 ? '#faad14' : '#ff4d4f'} />
          </div>
        </div>
      </div>

      <div className="battle-controls">
        <Title level={5}>操作区域</Title>
        <Space wrap>
          <Button type="primary" onClick={() => onAction('move 1')} disabled={!isActive}>技能 1</Button>
          <Button type="primary" onClick={() => onAction('move 2')} disabled={!isActive}>技能 2</Button>
          <Button type="primary" onClick={() => onAction('move 3')} disabled={!isActive}>技能 3</Button>
          <Button type="primary" onClick={() => onAction('move 4')} disabled={!isActive}>技能 4</Button>
          <Button onClick={() => onAction('switch 2')} disabled={!isActive}>换人</Button>
        </Space>
      </div>
    </div>
  );
};
