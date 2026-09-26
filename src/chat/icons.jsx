import React from 'react';

function Svg({ children }) {
  return <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}

export function IconBack() {
  return <Svg><path d="M15 5 8 12l7 7" /></Svg>;
}
export function IconSend() {
  return <Svg><path d="M5 12h12M13 6l6 6-6 6" /></Svg>;
}
export function IconHint() {
  return <Svg><path d="M9 18h6M10 21h4" /><path d="M8 14a5 5 0 1 1 8 0c-.7.8-1.4 1.4-1.7 2.2-.2.5-.3.9-.3 1.3H10c0-.4-.1-.8-.3-1.3C9.4 15.4 8.7 14.8 8 14Z" /></Svg>;
}
export function IconImage() {
  return <Svg><rect x="4" y="5" width="16" height="14" rx="2" /><path d="m8 15 2.5-2.5L14 16l2-2 2 2" /><circle cx="9" cy="9" r="1" /></Svg>;
}
export function IconContinue() {
  return <Svg><path d="M8 6v12l10-6-10-6Z" /></Svg>;
}
export function IconHome() {
  return <Svg><path d="M4 11.5 12 5l8 6.5" /><path d="M7 10.5V19h10v-8.5" /></Svg>;
}
export function IconLearn() {
  return <Svg><path d="M5 6.5h10a3 3 0 0 1 3 3V19H8a3 3 0 0 0-3 3Z" /><path d="M5 6.5a3 3 0 0 0-0 0" /><path d="M5 6.5v13" /></Svg>;
}
export function IconUser() {
  return <Svg><circle cx="12" cy="8" r="3" /><path d="M5.5 19a6.5 6.5 0 0 1 13 0" /></Svg>;
}
