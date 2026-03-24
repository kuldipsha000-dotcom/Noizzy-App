import { createContext, useContext } from 'react';
import type { RefObject } from 'react';

export const AudioContext = createContext<RefObject<HTMLAudioElement | null>>({ current: null });
export const useAudio = () => useContext(AudioContext);
