import React from 'react';

const sampleBrands = ['Google', 'Figma', 'Notion', 'Zoom'];

// Visual exploration only: none of these brands is an asserted partner or integration.
export function PartnerPreview() {
  return <section className="home-partner-preview home-container" aria-labelledby="home-partners-title">
    <div className="home-partner-heading">
      <h2 id="home-partners-title">ตัวอย่างพื้นที่พาร์ทเนอร์</h2>
      <p>ทดลองเลย์เอาต์เท่านั้น แบรนด์ด้านล่างไม่ใช่พาร์ทเนอร์ที่ยืนยันแล้ว</p>
    </div>
    <ul className="home-partner-logos">{sampleBrands.map((name) => <li key={name}>
      <img src={`https://cdn.simpleicons.org/${name.toLowerCase()}/607D91`} width={name === 'Zoom' ? 94 : 30} height="30" alt={name === 'Zoom' ? 'Zoom' : ''} loading="lazy" onError={(event) => { event.currentTarget.hidden = true; event.currentTarget.nextElementSibling.hidden = false; }} />
      <span hidden={name === 'Zoom'}>{name}</span>
    </li>)}</ul>
  </section>;
}
