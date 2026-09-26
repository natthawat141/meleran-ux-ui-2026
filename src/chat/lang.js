import { copy } from './copy.js';
import { useChat } from './store.jsx';

export function useLang() {
  const { data } = useChat();
  const label = (key) => copy[data.lang][key];
  const field = (value) => value?.[data.lang] ?? value?.th ?? '';
  return { lang: data.lang, label, field };
}
