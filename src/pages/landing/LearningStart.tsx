import { BookOutlined, PlayCircleOutlined, FormOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';

const steps = [
  { icon: BookOutlined, title: 'ค้นหาคอร์สที่ใช่', description: 'ดูเนื้อหาและผู้สอน เลือกเรื่องที่อยากเรียนรู้' },
  { icon: PlayCircleOutlined, title: 'เรียนในเวลาของคุณ', description: 'เปิดบทเรียน แล้วกลับมาทบทวนในคอร์สของคุณ' },
  { icon: FormOutlined, title: 'ลองทำให้เข้าใจ', description: 'ฝึกจากกิจกรรมและแบบฝึกหัดในบทเรียน' },
];

export function LearningStart() {
  return (
    <section id="how-it-works" className="home-start" aria-labelledby="home-start-title">
      <div className="home-container">
        <div className="home-collection-heading">
          <div><p className="home-landing-kicker">เริ่มต้นกับ MELEARN</p><h2 id="home-start-title">พร้อมเรียนรู้เรื่อง<span>ใหม่ ๆ แล้วหรือยัง?</span></h2><p>จากความสนใจ สู่การลงมือทำ เริ่มได้ในสามขั้นตอน</p></div>
          <Link to="/courses" className="home-collection-link">เลือกคอร์สเรียน <ArrowRightOutlined aria-hidden="true" /></Link>
        </div>
        <ol className="home-start-steps">
          {steps.map(({ icon: Icon, title, description }, index) => (
            <li key={title}><div className="home-start-step-top"><span className="home-start-icon"><Icon aria-hidden="true" /></span><span className="home-start-number">0{index + 1}</span></div><h3>{title}</h3><p>{description}</p></li>
          ))}
        </ol>
      </div>
    </section>
  );
}
