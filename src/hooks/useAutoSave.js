import { useEffect } from 'react';
import { saveGame } from '../utils/storage.js';

export function useAutoSave(engineRef) {
  useEffect(() => {
    const flush = () => {
      if (engineRef.current) saveGame(engineRef.current);
    };
    flush();
    const timer = window.setInterval(flush, 2000);
    const onHide = () => {
      if (document.hidden) flush();
    };
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', onHide);
      flush();
    };
  }, [engineRef]);
}
