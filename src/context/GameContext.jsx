import { createContext, useContext } from 'react';
import { useGameState } from '../hooks/useGameState.js';

const GameContext = createContext(null);

export function GameProvider({ children }) {
  const game = useGameState();
  return <GameContext.Provider value={game}>{children}</GameContext.Provider>;
}

export function useGame() {
  const game = useContext(GameContext);
  if (!game) throw new Error('useGame must be used inside GameProvider');
  return game;
}
