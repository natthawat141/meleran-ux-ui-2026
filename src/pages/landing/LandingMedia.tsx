import React, { useState } from 'react';
import { PictureOutlined } from '@ant-design/icons';
import learningArtwork from '../../assets/generated/guide-learning-path-v2.png';
import writingArtwork from '../../assets/generated/article-writing-v2.png';
import dataArtwork from '../../assets/generated/article-data-v2.png';

export interface LandingPhotoItem {
  src: string;
  alt: string;
}

export const landingPhotos: Record<'learning' | 'writing' | 'data', LandingPhotoItem> = {
  learning: {
    src: learningArtwork,
    alt: 'ภาพกราฟิกเส้นทางการเรียนรู้ที่ค่อย ๆ ก้าวขึ้นไปทีละขั้น',
  },
  writing: {
    src: writingArtwork,
    alt: 'ภาพกราฟิกกระดาษเขียนงานที่จัดข้อความให้ชัดเจน',
  },
  data: {
    src: dataArtwork,
    alt: 'ภาพกราฟิกกราฟหลายรูปแบบสำหรับเปรียบเทียบข้อมูล',
  },
};

export interface LandingPhotoProps {
  photo: LandingPhotoItem;
  className?: string;
}

export function LandingPhoto({ photo, className = '' }: LandingPhotoProps) {
  const [failed, setFailed] = useState(false);
  return (
    <figure className={`home-editorial-photo ${className}`}>
      {failed ? (
        <div className="home-photo-fallback" role="img" aria-label={photo.alt}>
          <PictureOutlined aria-hidden="true" />
          <span>ภาพประกอบการเรียนรู้</span>
        </div>
      ) : (
        <img
          src={photo.src}
          alt={photo.alt}
          loading="lazy"
          decoding="async"
          width="1000"
          height="700"
          onError={() => setFailed(true)}
        />
      )}
    </figure>
  );
}
