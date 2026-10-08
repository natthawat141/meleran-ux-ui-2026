import writingArticleCover from '../assets/generated/article-writing-v2.png';
import dataArticleCover from '../assets/generated/article-data-v2.png';
import focusCover from '../assets/generated/course-focus-v2.png';

export interface BlogCoverOption {
  value: string;
  label: string;
  src: string;
}

export const blogCovers: BlogCoverOption[] = [
  { value: 'writing', label: 'การเขียนและการสื่อสาร', src: writingArticleCover },
  { value: 'data', label: 'ข้อมูลและการคิด', src: dataArticleCover },
  { value: 'focus', label: 'การเรียนรู้และการทำงาน', src: focusCover },
];

export const blogCoverFor = (key?: string): string =>
  blogCovers.find((cover) => cover.value === key)?.src ?? writingArticleCover;
